"""
Products router
GET  /v1/products/barcode/{code}
GET  /v1/products/{id}
PATCH /v1/products/{id}
POST /v1/products
GET  /v1/products/{id}/price-history
"""
import uuid
import re
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.product import Product, Category, PriceHistory
from app.models.inventory import StockMovement
from app.schemas.product import ProductOut, ProductBarcodeOut, ProductCreateRequest, ProductUpdateRequest

router = APIRouter()


def _urgency(stock: int, velocity: float) -> str:
    if velocity <= 0:
        return "normal" if stock > 5 else "high"
    days = stock / velocity
    if days <= 2:
        return "critical"
    if days <= 5:
        return "high"
    return "normal"


async def _daily_velocity(db: AsyncSession, product_id: str, shop_id: str) -> float:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(func.sum(StockMovement.quantity)).where(
            StockMovement.product_id == product_id,
            StockMovement.shop_id == shop_id,
            StockMovement.movement_type == "sale",
            StockMovement.created_at >= cutoff,
        )
    )
    total = result.scalar() or 0
    return round(total / 30, 2)


async def _category_breadcrumb(db: AsyncSession, category_id: str | None) -> str:
    if not category_id:
        return "Uncategorised"
    cat = await db.get(Category, category_id)
    if not cat:
        return "Uncategorised"
    if cat.parent_id:
        parent = await db.get(Category, cat.parent_id)
        return f"{parent.name} > {cat.name}" if parent else cat.name
    return cat.name


def _sku_from_name(name: str, product_id: str) -> str:
    prefix = re.sub(r"[^A-Z0-9]", "", name.upper())[:4].ljust(3, "X")
    return f"{prefix}-{product_id[:4].upper()}"


async def _build_product_out(db: AsyncSession, product: Product, shop_id: str) -> ProductOut:
    velocity = await _daily_velocity(db, product.id, shop_id)
    breadcrumb = await _category_breadcrumb(db, product.category_id)
    margin = 0.0
    if product.buy_price_pesawas > 0:
        margin = round((product.sell_price_pesawas - product.buy_price_pesawas) / product.buy_price_pesawas * 100, 1)

    ph_rows = (await db.execute(
        select(PriceHistory)
        .where(PriceHistory.product_id == product.id)
        .order_by(PriceHistory.created_at.desc())
        .limit(5)
    )).scalars().all()
    history = [
        {"name": ph.supplier_name, "date": ph.created_at.strftime("%Y-%m-%d"),
         "unit_cost_pesawas": ph.unit_cost_pesawas, "best": False}
        for ph in ph_rows
    ]
    if history:
        min(history, key=lambda h: h["unit_cost_pesawas"])["best"] = True

    return ProductOut(
        product_id=product.id,
        sku=product.sku,
        name=product.name,
        emoji=product.emoji,
        category_breadcrumb=breadcrumb,
        current_stock=product.current_stock,
        urgency=_urgency(product.current_stock, velocity),
        daily_velocity=velocity,
        margin_pct=margin,
        buy_price_pesawas=product.buy_price_pesawas,
        sell_price_pesawas=product.sell_price_pesawas,
        supplier_history=history,
    )


@router.get("/barcode/{code}", response_model=ProductBarcodeOut)
async def get_by_barcode(
    code: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(Product).where(Product.barcode == code, Product.shop_id == shop.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    cat = await db.get(Category, product.category_id) if product.category_id else None
    return ProductBarcodeOut(
        product_id=product.id,
        name=product.name,
        barcode=product.barcode,
        sell_price_pesawas=product.sell_price_pesawas,
        buy_price_pesawas=product.buy_price_pesawas,
        current_stock=product.current_stock,
        category={"id": cat.id, "name": cat.name, "breadcrumb": cat.name} if cat else None,
    )


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return await _build_product_out(db, product, shop.id)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    body: ProductUpdateRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if body.sell_price_pesawas is not None:
        product.sell_price_pesawas = body.sell_price_pesawas
    if body.buy_price_pesawas is not None:
        product.buy_price_pesawas = body.buy_price_pesawas
        # Record price history
        ph = PriceHistory(
            id=str(uuid.uuid4()),
            product_id=product.id,
            supplier_name="Manual",
            unit_cost_pesawas=body.buy_price_pesawas,
        )
        db.add(ph)
    product.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(product)
    return await _build_product_out(db, product, shop.id)


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(
    body: ProductCreateRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    pid = str(uuid.uuid4())
    sku = _sku_from_name(body.name, pid)

    product = Product(
        id=pid,
        shop_id=shop.id,
        name=body.name,
        barcode=body.barcode or None,
        sku=sku,
        category_id=body.category_id or None,
        buy_price_pesawas=body.buy_price_pesawas,
        sell_price_pesawas=body.sell_price_pesawas,
        current_stock=body.initial_stock,
    )
    db.add(product)

    if body.buy_price_pesawas > 0:
        ph = PriceHistory(
            id=str(uuid.uuid4()),
            product_id=pid,
            supplier_name="Initial",
            unit_cost_pesawas=body.buy_price_pesawas,
        )
        db.add(ph)

    if body.initial_stock > 0:
        mv = StockMovement(
            id=str(uuid.uuid4()),
            shop_id=shop.id,
            product_id=pid,
            movement_type="purchase",
            quantity=body.initial_stock,
            unit_cost_pesawas=body.buy_price_pesawas,
            notes="Initial stock",
        )
        db.add(mv)

    await db.commit()
    await db.refresh(product)
    return await _build_product_out(db, product, shop.id)


@router.get("/{product_id}/price-history")
async def price_history(
    product_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    ph_result = await db.execute(
        select(PriceHistory)
        .where(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.created_at.desc())
        .limit(50)
    )
    history = ph_result.scalars().all()
    avg = sum(h.unit_cost_pesawas for h in history) // len(history) if history else 0

    ledger = [
        {
            "date": h.created_at.strftime("%Y-%m-%d"),
            "supplier": h.supplier_name,
            "unit_cost_pesawas": h.unit_cost_pesawas,
        }
        for h in history
    ]

    return {
        "product_id": product.id,
        "name": product.name,
        "sku": product.sku,
        "current_avg_pesawas": avg,
        "volatility": "low",
        "benchmarking": [],
        "best_opportunity": None,
        "cost_risk": "low",
        "purchase_ledger": ledger,
    }
