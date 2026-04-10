"""
Sales router
POST /v1/sales
GET  /v1/sales/batch/today
GET  /v1/transactions/search
"""
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.inventory import StockMovement
from app.schemas.sale import SaleCreateRequest, SaleCreateResponse, DailyBatchResponse, SearchResponse

router = APIRouter()


def _ref() -> str:
    import random, string
    return "SK" + "".join(random.choices(string.digits, k=8))


@router.post("", response_model=SaleCreateResponse, status_code=201)
async def create_sale(
    body: SaleCreateRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth

    # Validate all products exist and have sufficient stock
    for item in body.items:
        result = await db.execute(
            select(Product).where(Product.id == item.product_id, Product.shop_id == shop.id)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.current_stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}: {product.current_stock} available",
            )

    sale_id = str(uuid.uuid4())
    sale = Sale(
        id=sale_id,
        shop_id=shop.id,
        reference=_ref(),
        total_pesawas=body.total_pesawas,
        payment_method=body.payment_method,
    )
    db.add(sale)

    for item in body.items:
        si = SaleItem(
            id=str(uuid.uuid4()),
            sale_id=sale_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price_pesawas=item.unit_price_pesawas,
        )
        db.add(si)

        # Deduct stock
        result = await db.execute(
            select(Product).where(Product.id == item.product_id)
        )
        product = result.scalar_one()
        product.current_stock -= item.quantity

        # Record movement
        mv = StockMovement(
            id=str(uuid.uuid4()),
            shop_id=shop.id,
            product_id=item.product_id,
            movement_type="sale",
            quantity=item.quantity,
        )
        db.add(mv)

    await db.commit()
    return SaleCreateResponse(
        sale_id=sale_id,
        reference=sale.reference,
        total_pesawas=body.total_pesawas,
        items_count=len(body.items),
        stock_updated=True,
    )


@router.get("/{sale_id}")
async def get_sale(
    sale_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a completed sale with its line items — used for WhatsApp receipt."""
    _, shop = auth
    sale = await db.get(Sale, sale_id)
    if not sale or sale.shop_id != shop.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sale not found")

    items_result = await db.execute(select(SaleItem).where(SaleItem.sale_id == sale_id))
    items = items_result.scalars().all()

    line_items = []
    for item in items:
        product = await db.get(Product, item.product_id)
        line_items.append({
            "product_id": item.product_id,
            "name": product.name if product else "Unknown",
            "emoji": (product.emoji or "📦") if product else "📦",
            "quantity": item.quantity,
            "unit_price_pesawas": item.unit_price_pesawas,
            "subtotal_pesawas": item.quantity * item.unit_price_pesawas,
        })

    return {
        "sale_id": sale.id,
        "reference": sale.reference,
        "total_pesawas": sale.total_pesawas,
        "payment_method": sale.payment_method,
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
        "items": line_items,
    }


@router.get("/batch/today", response_model=DailyBatchResponse)
async def today_batch(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    result = await db.execute(
        select(Sale).where(
            Sale.shop_id == shop.id,
            Sale.created_at >= today_start,
        ).order_by(Sale.created_at.desc())
    )
    sales = result.scalars().all()

    total = sum(s.total_pesawas for s in sales)
    breakdown = {
        "cash": sum(s.total_pesawas for s in sales if s.payment_method == "cash"),
        "momo": sum(s.total_pesawas for s in sales if s.payment_method == "momo"),
        "credit": sum(s.total_pesawas for s in sales if s.payment_method == "credit"),
    }

    activity = [
        {
            "time": s.created_at.strftime("%H:%M"),
            "description": f"Sale #{s.reference}",
            "method": s.payment_method,
            "amount_pesawas": s.total_pesawas,
        }
        for s in sales
    ]

    return DailyBatchResponse(
        date=today.isoformat(),
        total_pesawas=total,
        payment_breakdown=breakdown,
        status="balanced",
        activity=activity,
    )
