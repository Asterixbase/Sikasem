"""
Reports router
GET /v1/reports/dashboard
GET /v1/reports/dashboard/sold-today
GET /v1/reports/dashboard/low-stock
GET /v1/reports/margins
GET /v1/reports/sales
GET /v1/reports/supplier-prices
GET /v1/reports/analytics
GET /v1/reports/retail-insights
"""
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.product import Product, Category, PriceHistory
from app.models.sale import Sale, SaleItem
from app.models.credit import CreditSale

router = APIRouter()


async def _get_daily_velocity(db: AsyncSession, product: Product, shop_id: str) -> float:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(func.sum(SaleItem.quantity))
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(
            SaleItem.product_id == product.id,
            Sale.shop_id == shop_id,
            Sale.created_at >= cutoff,
        )
    )
    total = result.scalar() or 0
    return round(total / 30, 2)


@router.get("/dashboard")
async def dashboard(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    # Today revenue
    rev_result = await db.execute(
        select(func.sum(Sale.total_pesawas)).where(
            Sale.shop_id == shop.id,
            Sale.created_at >= today_start,
        )
    )
    today_revenue = rev_result.scalar() or 0

    # Items sold today
    sold_result = await db.execute(
        select(func.sum(SaleItem.quantity))
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
    )
    sold_today = sold_result.scalar() or 0

    # Total SKUs
    sku_result = await db.execute(
        select(func.count(Product.id)).where(Product.shop_id == shop.id)
    )
    total_skus = sku_result.scalar() or 0

    # Products
    prod_result = await db.execute(select(Product).where(Product.shop_id == shop.id))
    products = prod_result.scalars().all()

    # Avg margin
    margins = []
    low_stock_items = []
    for p in products:
        if (p.buy_price_pesawas or 0) > 0 and (p.sell_price_pesawas or 0) > 0:
            m = (p.sell_price_pesawas - p.buy_price_pesawas) / p.buy_price_pesawas * 100
            margins.append(m)
        velocity = await _get_daily_velocity(db, p, shop.id)
        days_left = (p.current_stock / velocity) if velocity > 0 else 999
        if p.current_stock <= 5 or days_left <= 3:
            low_stock_items.append(p)

    avg_margin = round(sum(margins) / len(margins), 1) if margins else 0.0

    # Alerts
    alerts = []
    for p in low_stock_items[:5]:
        urgency = "critical" if p.current_stock == 0 else "high"
        alerts.append({
            "type": "low_stock",
            "message": f"{p.name} — only {p.current_stock} units left",
            "urgency": urgency,
        })

    # Overdue credit
    overdue_result = await db.execute(
        select(func.count(CreditSale.id)).where(
            CreditSale.shop_id == shop.id,
            CreditSale.status == "pending",
            CreditSale.due_date < today,
        )
    )
    overdue_count = overdue_result.scalar() or 0
    if overdue_count:
        alerts.append({
            "type": "overdue_credit",
            "message": f"{overdue_count} credit sale(s) are overdue",
            "urgency": "critical",
        })

    return {
        "today_revenue_pesawas": today_revenue,
        "sold_today_count": sold_today,
        "low_stock_count": len(low_stock_items),
        "avg_margin_pct": avg_margin,
        "total_skus": total_skus,
        "alerts": alerts,
        "quick_actions": ["scan", "sale", "credit", "tax"],
    }


@router.get("/dashboard/sold-today")
async def sold_today(
    sort: str = Query(default="rev"),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    result = await db.execute(
        select(SaleItem, Sale)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
    )
    rows = result.all()

    # Aggregate by product
    agg: dict[str, dict] = {}
    for si, sale in rows:
        pid = si.product_id
        if pid not in agg:
            product = await db.get(Product, pid)
            agg[pid] = {
                "product_id": pid,
                "name": product.name if product else "Unknown",
                "emoji": product.emoji if product else "📦",
                "category": "",
                "units_sold": 0,
                "transactions": 0,
                "revenue_pesawas": 0,
                "cogs_pesawas": 0,
                "margin_pct": 0.0,
            }
            if product and product.category_id:
                cat = await db.get(Category, product.category_id)
                agg[pid]["category"] = cat.name if cat else ""
        agg[pid]["units_sold"] += si.quantity
        agg[pid]["transactions"] += 1
        agg[pid]["revenue_pesawas"] += si.quantity * si.unit_price_pesawas
        product = await db.get(Product, pid)
        if product:
            agg[pid]["cogs_pesawas"] += si.quantity * product.buy_price_pesawas

    items = list(agg.values())
    for item in items:
        if item["cogs_pesawas"] > 0:
            item["margin_pct"] = round(
                (item["revenue_pesawas"] - item["cogs_pesawas"]) / item["cogs_pesawas"] * 100, 1
            )

    sort_key = {"rev": "revenue_pesawas", "units": "units_sold", "margin": "margin_pct"}.get(sort, "revenue_pesawas")
    items.sort(key=lambda x: x[sort_key], reverse=True)

    total_rev = sum(i["revenue_pesawas"] for i in items)
    total_cogs = sum(i["cogs_pesawas"] for i in items)

    return {
        "sort": sort,
        "total_revenue_pesawas": total_rev,
        "total_cogs_pesawas": total_cogs,
        "gross_profit_pesawas": total_rev - total_cogs,
        "items": items,
    }


@router.get("/dashboard/low-stock")
async def low_stock(
    urgency: str = Query(default="all"),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(select(Product).where(Product.shop_id == shop.id))
    products = result.scalars().all()

    items = []
    for p in products:
        velocity = await _get_daily_velocity(db, p, shop.id)
        days_remaining = round(p.current_stock / velocity, 1) if velocity > 0 else 999
        if p.current_stock == 0 or days_remaining <= 3:
            u = "critical"
        elif days_remaining <= 7 or p.current_stock <= 5:
            u = "high"
        else:
            u = "normal"

        if urgency != "all" and u != urgency:
            continue
        if u == "normal" and days_remaining > 7:
            continue

        items.append({
            "product_id": p.id,
            "name": p.name,
            "current_stock": p.current_stock,
            "daily_velocity": velocity,
            "days_remaining": days_remaining,
            "urgency": u,
            "suggested_order_qty": max(int(velocity * 14), 10),
        })

    items.sort(key=lambda x: x["days_remaining"])
    return {"items": items}


@router.get("/margins")
async def margins(
    days: int = Query(default=30),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(SaleItem, Sale)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
    )
    rows = result.all()

    margins_list = []
    for si, sale in rows:
        product = await db.get(Product, si.product_id)
        if product and product.buy_price_pesawas > 0:
            m = (si.unit_price_pesawas - product.buy_price_pesawas) / product.buy_price_pesawas * 100
            margins_list.append(m)

    avg = round(sum(margins_list) / len(margins_list), 1) if margins_list else 0.0
    return {
        "period_days": days,
        "avg_margin_pct": avg,
        "categories": [],
        "top_performers": [],
        "bottom_performers": [],
    }


@router.get("/sales")
async def sales_report(
    period: str = Query(default="30d"),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(Sale).where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
    )
    sales = result.scalars().all()

    total_rev = sum(s.total_pesawas for s in sales)
    count = len(sales)
    avg_tx = total_rev // count if count > 0 else 0

    return {
        "total_revenue_pesawas": total_rev,
        "avg_transaction_pesawas": avg_tx,
        "total_items": 0,
        "total_transactions": count,
        "net_profit_pesawas": 0,
        "categories": [],
        "high_value_sales": [],
        "trend_pct": 0.0,
    }


@router.get("/supplier-prices")
async def supplier_prices(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(select(Product).where(Product.shop_id == shop.id))
    products = result.scalars().all()

    out = []
    for p in products:
        ph_result = await db.execute(
            select(PriceHistory).where(PriceHistory.product_id == p.id)
        )
        history = ph_result.scalars().all()
        if not history:
            continue
        suppliers = {}
        for h in history:
            if h.supplier_name not in suppliers:
                suppliers[h.supplier_name] = []
            suppliers[h.supplier_name].append(h.unit_cost_pesawas)
        supplier_list = [
            {
                "name": name,
                "avg_buy_pesawas": sum(prices) // len(prices),
                "index": 0,
                "last_purchase": history[0].created_at.strftime("%Y-%m-%d"),
            }
            for name, prices in suppliers.items()
        ]
        cheapest = min(supplier_list, key=lambda s: s["avg_buy_pesawas"])
        out.append({
            "product_id": p.id,
            "name": p.name,
            "suppliers": supplier_list,
            "cheapest_supplier": cheapest["name"],
            "monthly_saving_pesawas": 0,
        })

    return {"products": out}


@router.get("/analytics")
async def analytics(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(Sale).where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
    )
    sales = result.scalars().all()
    total = sum(s.total_pesawas for s in sales)
    count = len(sales)

    return {
        "net_profit_pesawas": 0,
        "trend_pct": 0.0,
        "total_revenue_pesawas": total,
        "avg_transaction_pesawas": total // count if count else 0,
        "daily_velocity": round(count / 30, 1),
        "growth_margin_pct": 0.0,
        "categories": [],
        "ai_insight": "Record more sales to unlock insights.",
        "inventory_flow": {"restock_required": 0, "overstocked": 0},
    }


@router.get("/retail-insights")
async def retail_insights(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    daily = []
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        d_start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        d_end = d_start + timedelta(days=1)
        result = await db.execute(
            select(func.sum(Sale.total_pesawas)).where(
                Sale.shop_id == shop.id,
                Sale.created_at >= d_start,
                Sale.created_at < d_end,
            )
        )
        daily.append({"date": d.isoformat(), "revenue_pesawas": result.scalar() or 0})

    weekly_rev = sum(d["revenue_pesawas"] for d in daily)
    return {
        "weekly_revenue_pesawas": weekly_rev,
        "weekly_profit_pesawas": 0,
        "trend_pct": 0.0,
        "daily_chart": daily,
        "peak_times": [],
        "top_items": [],
        "inventory_alert": None,
    }
