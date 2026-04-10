"""
Reorder router
GET /v1/reorder/suggestions
GET /v1/reorder/whatsapp-order
"""
import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.product import Product, PriceHistory
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


async def _day_of_week_analysis(
    db: AsyncSession, product_id: str, shop_id: str
) -> tuple[float, str | None]:
    """
    Returns (boost_factor, peak_day_label).
    boost_factor > 1 means today is a higher-than-average sales day for this product.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(SaleItem.quantity, Sale.created_at)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(
            SaleItem.product_id == product_id,
            Sale.shop_id == shop_id,
            Sale.created_at >= cutoff,
        )
    )
    rows = result.all()
    if not rows:
        return 1.0, None

    by_day: dict[int, float] = {i: 0.0 for i in range(7)}
    day_counts: dict[int, int] = {i: 0 for i in range(7)}
    for qty, created_at in rows:
        dow = created_at.weekday()
        by_day[dow] += qty
        day_counts[dow] += 1

    # Average sales per occurrence of that weekday
    day_avg = {d: by_day[d] / max(day_counts[d], 1) for d in range(7)}
    overall_avg = sum(day_avg.values()) / 7

    if overall_avg == 0:
        return 1.0, None

    today_dow = datetime.now(timezone.utc).weekday()
    boost = round(day_avg[today_dow] / overall_avg, 2)

    DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    peak_dow = max(day_avg, key=day_avg.get)
    peak_day = DAYS[peak_dow] if day_avg[peak_dow] > 0 else None

    return boost, peak_day


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

        urgency = "critical" if days <= 2 else "high" if days <= 5 else "low"
        base_qty = max(int(v * 14), 5)

        # Day-of-week boost
        boost, peak_day = await _day_of_week_analysis(db, p.id, shop.id)
        suggested_qty = max(int(base_qty * max(boost, 1.0)), base_qty)

        # Latest supplier from price history
        ph_row = (await db.execute(
            select(PriceHistory)
            .where(PriceHistory.product_id == p.id)
            .order_by(PriceHistory.created_at.desc())
            .limit(1)
        )).scalars().first()

        supplier_name = ph_row.supplier_name if ph_row else "Unknown"
        price_changed = bool(ph_row and ph_row.unit_cost_pesawas != p.buy_price_pesawas)

        items.append({
            "id": str(p.id),
            "product_id": p.id,
            "name": p.name,
            "emoji": p.emoji or "📦",
            "current_stock": p.current_stock,
            "daily_velocity": v,
            "urgency": urgency,
            "suggested_qty": suggested_qty,
            "day_boost": boost,
            "peak_day": peak_day,
            "supplier_name": supplier_name,
            "supplier_matched": bool(ph_row),
            "price_changed": price_changed,
            "unit_price_pesawas": p.buy_price_pesawas,
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
    # items may be a JSON array string (from mobile) or comma-separated
    try:
        product_ids = json.loads(items) if items.strip().startswith("[") else [i.strip() for i in items.split(",") if i.strip()]
    except Exception:
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
