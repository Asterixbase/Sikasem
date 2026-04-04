"""
Reorder router
GET /v1/reorder/suggestions
GET /v1/reorder/whatsapp-order
"""
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.product import Product
from app.models.sale import Sale, SaleItem

router = APIRouter()


async def _velocity(db: AsyncSession, product_id: str, shop_id: str) -> float:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(func.sum(SaleItem.quantity))
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(
            SaleItem.product_id == product_id,
            Sale.shop_id == shop_id,
            Sale.created_at >= cutoff,
        )
    )
    return round((result.scalar() or 0) / 30, 2)


@router.get("/suggestions")
async def reorder_suggestions(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(select(Product).where(Product.shop_id == shop.id))
    products = result.scalars().all()

    items = []
    for p in products:
        v = await _velocity(db, p.id, shop.id)
        days = p.current_stock / v if v > 0 else 999
        if days > 7 and p.current_stock > 5:
            continue
        urgency = "critical" if days <= 2 else "high" if days <= 5 else "normal"
        suggested_qty = max(int(v * 14), 5)
        items.append({
            "id": str(p.id),
            "product_id": p.id,
            "name": p.name,
            "current_stock": p.current_stock,
            "daily_velocity": v,
            "urgency": urgency,
            "suggested_qty": suggested_qty,
            "suggested_unit": "units",
            "est_cost_pesawas": suggested_qty * p.buy_price_pesawas,
        })

    items.sort(key=lambda x: x["daily_velocity"], reverse=True)
    return {"items": items}


@router.get("/whatsapp-order")
async def whatsapp_order(
    items: str = Query(default=""),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    product_ids = [i.strip() for i in items.split(",") if i.strip()]
    order_lines = []
    total = 0

    for pid in product_ids:
        product = await db.get(Product, pid)
        if not product or product.shop_id != shop.id:
            continue
        v = await _velocity(db, pid, shop.id)
        qty = max(int(v * 14), 5)
        cost = qty * product.buy_price_pesawas
        total += cost
        order_lines.append(f"• {product.name} x{qty}")

    msg = f"Hi, I'd like to reorder the following items for {shop.name}:\n" + "\n".join(order_lines)
    if total:
        msg += f"\n\nEstimated total: GHS {total/100:.2f}"

    return {
        "wa_url": f"https://wa.me/?text={msg.replace(chr(10), '%0A').replace(' ', '%20')}",
        "message_text": msg,
        "message": msg,           # mobile wa-order.tsx reads this field
        "supplier": "Supplier",
        "supplier_name": "Supplier",
        "supplier_phone": "",     # no default supplier phone — user opens WA and picks contact
        "total_pesawas": total,
        "items": order_lines,
    }
