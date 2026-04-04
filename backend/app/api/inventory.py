"""
Inventory router
GET  /v1/inventory/movements
POST /v1/stock/movements
GET  /v1/inventory/audit
POST /v1/inventory/audit/confirm
"""
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.inventory import StockMovement
from app.models.product import Product
from app.schemas.inventory import StockMovementCreate, AuditConfirmRequest

router = APIRouter()

# Separate router for /stock/movements (POST only)
stock_router = APIRouter()


def _time_ago(dt: datetime) -> str:
    delta = datetime.now(timezone.utc) - dt
    if delta.seconds < 60:
        return "just now"
    if delta.seconds < 3600:
        return f"{delta.seconds // 60}m ago"
    if delta.days < 1:
        return f"{delta.seconds // 3600}h ago"
    return f"{delta.days}d ago"


@router.get("/movements")
async def get_movements(
    limit: int = Query(default=20, le=100),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(StockMovement)
        .where(StockMovement.shop_id == shop.id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
    )
    movements = result.scalars().all()

    items = []
    for mv in movements:
        product = await db.get(Product, mv.product_id)
        product_name = product.name if product else "Unknown"
        sign = "+" if mv.movement_type == "purchase" else "-"
        if mv.movement_type == "adjustment":
            sign = mv.adjustment_sign or "+"

        badge_map = {
            "purchase": "IN",
            "sale": "SALE",
            "adjustment": "ADJ",
        }

        items.append({
            "type": mv.movement_type,
            "title": f"{badge_map.get(mv.movement_type, 'MOV')} — {product_name}",
            "time_ago": _time_ago(mv.created_at),
            "change_qty": mv.quantity,
            "change_sign": sign,
            "item_name": product_name,
            "badge": badge_map.get(mv.movement_type, "MOV"),
            "note": mv.notes,
        })

    return {"items": items}


@stock_router.post("/movements", status_code=201)
async def add_movement(
    body: StockMovementCreate,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    product = await db.get(Product, body.product_id)
    if not product or product.shop_id != shop.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Product not found")

    mv = StockMovement(
        id=str(uuid.uuid4()),
        shop_id=shop.id,
        product_id=body.product_id,
        movement_type=body.movement_type,
        quantity=body.quantity,
        unit_cost_pesawas=body.unit_cost_pesawas,
        adjustment_sign=body.adjustment_sign,
        reason=body.reason,
        notes=body.notes,
    )
    db.add(mv)

    # Update stock
    if body.movement_type == "purchase":
        product.current_stock += body.quantity
    elif body.movement_type == "adjustment":
        if body.adjustment_sign == "+":
            product.current_stock += body.quantity
        else:
            product.current_stock = max(0, product.current_stock - body.quantity)

    await db.commit()
    return {"movement_id": mv.id, "new_stock": product.current_stock}


@router.get("/audit")
async def get_audit(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(Product).where(Product.shop_id == shop.id).order_by(Product.name)
    )
    products = result.scalars().all()

    items = [
        {
            "product_id": p.id,
            "name": p.name,
            "sku": p.sku,
            "expected_qty": p.current_stock,
            "actual_qty": None,
            "status": "pending",
        }
        for p in products
    ]

    return {
        "progress": {"verified": 0, "total": len(products), "pct": 0},
        "discrepancies": {"count": 0, "value_pesawas": 0},
        "items": items,
    }


@router.post("/audit/confirm")
async def confirm_audit(
    body: AuditConfirmRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    discrepancies = []
    for item in body.items:
        product = await db.get(Product, item.product_id)
        if not product or product.shop_id != shop.id:
            continue
        diff = item.actual_qty - product.current_stock
        if diff != 0:
            discrepancies.append({
                "product_id": product.id,
                "name": product.name,
                "expected": product.current_stock,
                "actual": item.actual_qty,
                "diff": diff,
            })
        product.current_stock = item.actual_qty
        if diff != 0:
            mv = StockMovement(
                id=str(uuid.uuid4()),
                shop_id=shop.id,
                product_id=product.id,
                movement_type="adjustment",
                quantity=abs(diff),
                adjustment_sign="+" if diff > 0 else "-",
                reason="correction",
                notes=f"Audit signed by {body.signed_by}",
            )
            db.add(mv)

    await db.commit()
    return {
        "signed_pdf_url": None,
        "discrepancy_report": {
            "signed_by": body.signed_by,
            "items_checked": len(body.items),
            "discrepancies": discrepancies,
        },
    }
