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
import asyncio
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
    velocity_cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    # Run all aggregate queries concurrently
    from sqlalchemy import case
    r_rev, r_sold, r_sku, r_prods, r_vel, r_overdue = await asyncio.gather(
        db.execute(
            select(func.sum(Sale.total_pesawas)).where(
                Sale.shop_id == shop.id, Sale.created_at >= today_start)
        ),
        db.execute(
            select(func.sum(SaleItem.quantity))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
        ),
        db.execute(select(func.count(Product.id)).where(Product.shop_id == shop.id)),
        db.execute(select(Product).where(Product.shop_id == shop.id)),
        # Batch velocity: total units sold per product in last 30d
        db.execute(
            select(SaleItem.product_id, func.sum(SaleItem.quantity).label("qty"))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= velocity_cutoff)
            .group_by(SaleItem.product_id)
        ),
        db.execute(
            select(func.count(CreditSale.id)).where(
                CreditSale.shop_id == shop.id,
                CreditSale.status == "pending",
                CreditSale.due_date < today,
            )
        ),
    )

    today_revenue = r_rev.scalar() or 0
    sold_today    = r_sold.scalar() or 0
    total_skus    = r_sku.scalar() or 0
    products      = r_prods.scalars().all()
    overdue_count = r_overdue.scalar() or 0

    # Build velocity map from batch result
    velocity_map: dict[str, float] = {
        str(row.product_id): round(row.qty / 30, 2)
        for row in r_vel.all()
    }

    margins = []
    low_stock_items = []
    for p in products:
        if (p.buy_price_pesawas or 0) > 0 and (p.sell_price_pesawas or 0) > 0:
            m = (p.sell_price_pesawas - p.buy_price_pesawas) / p.buy_price_pesawas * 100
            margins.append(m)
        velocity  = velocity_map.get(str(p.id), 0.0)
        days_left = (p.current_stock / velocity) if velocity > 0 else 999
        if p.current_stock <= 5 or days_left <= 3:
            low_stock_items.append(p)

    avg_margin = round(sum(margins) / len(margins), 1) if margins else 0.0

    # Build alerts: mixed critical / high / warning urgency for a realistic dashboard
    alerts = []
    for p in products:
        velocity  = velocity_map.get(str(p.id), 0.0)
        days_left = (p.current_stock / velocity) if velocity > 0 else 999
        if p.current_stock == 0:
            alerts.append({"type": "low_stock", "message": f"{p.name} is out of stock", "urgency": "critical"})
        elif days_left <= 2 or p.current_stock <= 2:
            alerts.append({"type": "low_stock", "message": f"{p.name} — {p.current_stock} units left ({round(days_left)}d)", "urgency": "critical"})
        elif days_left <= 7 or p.current_stock <= 5:
            alerts.append({"type": "low_stock", "message": f"{p.name} — {p.current_stock} units, restock soon", "urgency": "warning"})
    # Sort: critical first, then warning; cap at 6 total
    alerts.sort(key=lambda a: 0 if a["urgency"] == "critical" else 1)
    alerts = alerts[:6]
    if overdue_count:
        alerts.insert(0, {"type": "overdue_credit", "message": f"{overdue_count} credit sale(s) are overdue", "urgency": "critical"})

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

    # Single JOIN — no per-product round-trips
    result = await db.execute(
        select(
            SaleItem.product_id,
            SaleItem.quantity,
            SaleItem.unit_price_pesawas,
            Product.name,
            Product.emoji,
            Product.buy_price_pesawas,
            Category.name.label("cat_name"),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
    )
    rows = result.all()

    agg: dict[str, dict] = {}
    for row in rows:
        pid = str(row.product_id)
        if pid not in agg:
            agg[pid] = {
                "product_id": pid,
                "name": row.name,
                "emoji": row.emoji or "📦",
                "category": row.cat_name or "",
                "units_sold": 0, "transactions": 0,
                "revenue_pesawas": 0, "cogs_pesawas": 0, "margin_pct": 0.0,
            }
        agg[pid]["units_sold"]      += row.quantity
        agg[pid]["transactions"]    += 1
        agg[pid]["revenue_pesawas"] += row.quantity * row.unit_price_pesawas
        agg[pid]["cogs_pesawas"]    += row.quantity * (row.buy_price_pesawas or 0)

    items = list(agg.values())
    for item in items:
        if item["cogs_pesawas"] > 0:
            item["margin_pct"] = round(
                (item["revenue_pesawas"] - item["cogs_pesawas"]) / item["cogs_pesawas"] * 100, 1
            )

    sort_key = {"rev": "revenue_pesawas", "units": "units_sold", "margin": "margin_pct"}.get(sort, "revenue_pesawas")
    items.sort(key=lambda x: x[sort_key], reverse=True)
    total_rev  = sum(i["revenue_pesawas"] for i in items)
    total_cogs = sum(i["cogs_pesawas"]    for i in items)

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
    velocity_cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    prods_r, vel_r = await asyncio.gather(
        db.execute(select(Product).where(Product.shop_id == shop.id)),
        db.execute(
            select(SaleItem.product_id, func.sum(SaleItem.quantity).label("qty"))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= velocity_cutoff)
            .group_by(SaleItem.product_id)
        ),
    )
    products = prods_r.scalars().all()
    vel_map  = {str(row.product_id): round(row.qty / 30, 2) for row in vel_r.all()}

    items = []
    for p in products:
        velocity      = vel_map.get(str(p.id), 0.0)
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
    # Single JOIN — no per-product round-trips
    result = await db.execute(
        select(
            SaleItem.unit_price_pesawas,
            SaleItem.quantity,
            Product.name,
            Product.emoji,
            Product.buy_price_pesawas,
            Category.name.label("cat_name"),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
    )
    rows = result.all()

    margins_list = []
    cat_margins: dict[str, list[float]] = {}
    product_margins: dict[str, list[float]] = {}

    for row in rows:
        if (row.buy_price_pesawas or 0) > 0:
            m = (row.unit_price_pesawas - row.buy_price_pesawas) / row.buy_price_pesawas * 100
            margins_list.append(m)
            cat = row.cat_name or "Other"
            cat_margins.setdefault(cat, []).append(m)
            product_margins.setdefault(row.name, []).append(m)

    avg = round(sum(margins_list) / len(margins_list), 1) if margins_list else 0.0

    cat_list = [
        {"name": c, "avg_margin_pct": round(sum(ms) / len(ms), 1)}
        for c, ms in cat_margins.items()
    ]
    prod_list = [
        {"name": p, "avg_margin_pct": round(sum(ms) / len(ms), 1)}
        for p, ms in product_margins.items()
    ]
    prod_list.sort(key=lambda x: x["avg_margin_pct"], reverse=True)

    return {
        "period_days": days,
        "avg_margin_pct": avg,
        "categories": cat_list,
        "top_performers": prod_list[:5],
        "bottom_performers": prod_list[-5:] if len(prod_list) > 5 else [],
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

    # Single JOIN query: sale_items + products + categories
    rows_result = await db.execute(
        select(
            SaleItem.quantity,
            SaleItem.unit_price_pesawas,
            SaleItem.sale_id,
            Product.name.label("product_name"),
            Product.emoji,
            Product.buy_price_pesawas,
            Category.name.label("cat_name"),
            Sale.total_pesawas.label("sale_total"),
            Sale.created_at.label("sale_date"),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
    )
    rows = rows_result.all()

    total_rev = 0
    gross_profit = 0
    cat_revenue: dict[str, int] = {}
    recent_by_sale: dict[str, dict] = {}

    for row in rows:
        line_rev = row.unit_price_pesawas * row.quantity
        total_rev += line_rev
        gross_profit += (row.unit_price_pesawas - (row.buy_price_pesawas or 0)) * row.quantity
        cat = row.cat_name or "Other"
        cat_revenue[cat] = cat_revenue.get(cat, 0) + line_rev
        # Track highest-value line per sale for recent list
        existing = recent_by_sale.get(str(row.sale_id))
        if not existing or line_rev > existing["amount_pesawas"]:
            recent_by_sale[str(row.sale_id)] = {
                "name": row.product_name,
                "emoji": row.emoji or "📦",
                "amount_pesawas": line_rev,
                "date": row.sale_date.strftime("%d/%m/%Y"),
                "sale_total": row.sale_total,
            }

    count = len(set(str(row.sale_id) for row in rows))
    avg_tx = total_rev // count if count > 0 else 0

    cat_breakdown = [
        {"name": n, "pct": round(r / total_rev * 100, 1), "insight": None}
        for n, r in sorted(cat_revenue.items(), key=lambda x: x[1], reverse=True)[:6]
    ] if total_rev > 0 else []

    recent_sales = sorted(recent_by_sale.values(), key=lambda x: x["sale_total"], reverse=True)[:8]
    for r in recent_sales:
        r.pop("sale_total", None)

    return {
        "revenue_pesawas": total_rev,
        "gross_profit_pesawas": max(gross_profit, 0),
        "transactions": count,
        "avg_order_pesawas": avg_tx,
        "return_rate_pct": 0.0,
        "categories": cat_breakdown,
        "recent_sales": recent_sales,
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
    week_start = datetime.now(timezone.utc) - timedelta(days=7)

    # Single query — GROUP BY date, no per-day round-trips
    from sqlalchemy import cast, Date as SQLDate
    result = await db.execute(
        select(
            cast(Sale.created_at, SQLDate).label("sale_date"),
            func.sum(Sale.total_pesawas).label("rev"),
        )
        .where(Sale.shop_id == shop.id, Sale.created_at >= week_start)
        .group_by(cast(Sale.created_at, SQLDate))
    )
    rev_by_date = {str(row.sale_date): row.rev for row in result.all()}

    daily = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        daily.append({"date": d, "revenue_pesawas": rev_by_date.get(d, 0)})

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
