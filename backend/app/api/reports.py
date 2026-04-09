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
    yesterday = today - timedelta(days=1)
    today_start     = datetime(today.year,     today.month,     today.day,     tzinfo=timezone.utc)
    yesterday_start = datetime(yesterday.year, yesterday.month, yesterday.day, tzinfo=timezone.utc)
    velocity_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # Run all aggregate queries concurrently
    (
        r_rev, r_cash, r_momo,
        r_sold, r_sku,
        r_prods, r_vel, r_overdue,
        r_yrev, r_ysold,
        r_sku_week, r_recent_sales,
        r_top_today,
    ) = await asyncio.gather(
        # Today revenue (total)
        db.execute(
            select(func.sum(Sale.total_pesawas))
            .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
        ),
        # Today cash revenue
        db.execute(
            select(func.sum(Sale.total_pesawas))
            .where(Sale.shop_id == shop.id, Sale.created_at >= today_start, Sale.payment_method == "cash")
        ),
        # Today momo revenue
        db.execute(
            select(func.sum(Sale.total_pesawas))
            .where(Sale.shop_id == shop.id, Sale.created_at >= today_start, Sale.payment_method == "momo")
        ),
        # Today units sold
        db.execute(
            select(func.sum(SaleItem.quantity))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
        ),
        # Total SKUs
        db.execute(select(func.count(Product.id)).where(Product.shop_id == shop.id)),
        # All products (for low-stock + margins)
        db.execute(select(Product).where(Product.shop_id == shop.id)),
        # Batch velocity last 30d
        db.execute(
            select(SaleItem.product_id, func.sum(SaleItem.quantity).label("qty"))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= velocity_cutoff)
            .group_by(SaleItem.product_id)
        ),
        # Overdue credit count
        db.execute(
            select(func.count(CreditSale.id)).where(
                CreditSale.shop_id == shop.id,
                CreditSale.status == "pending",
                CreditSale.due_date < today,
            )
        ),
        # Yesterday revenue
        db.execute(
            select(func.sum(Sale.total_pesawas))
            .where(Sale.shop_id == shop.id,
                   Sale.created_at >= yesterday_start,
                   Sale.created_at < today_start)
        ),
        # Yesterday units sold
        db.execute(
            select(func.sum(SaleItem.quantity))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id,
                   Sale.created_at >= yesterday_start,
                   Sale.created_at < today_start)
        ),
        # SKUs added this week
        db.execute(
            select(func.count(Product.id))
            .where(Product.shop_id == shop.id, Product.created_at >= week_ago)
        ),
        # Recent 5 sales (for activity feed)
        db.execute(
            select(Sale).where(Sale.shop_id == shop.id)
            .order_by(Sale.created_at.desc()).limit(5)
        ),
        # Top product sold today by qty
        db.execute(
            select(
                Product.name,
                Product.emoji,
                func.sum(SaleItem.quantity).label("units"),
                func.sum(SaleItem.quantity * SaleItem.unit_price_pesawas).label("rev"),
            )
            .join(SaleItem, Product.id == SaleItem.product_id)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
            .group_by(Product.id, Product.name, Product.emoji)
            .order_by(func.sum(SaleItem.quantity).desc())
            .limit(1)
        ),
    )

    today_revenue  = r_rev.scalar()  or 0
    today_cash     = r_cash.scalar() or 0
    today_momo     = r_momo.scalar() or 0
    sold_today     = r_sold.scalar() or 0
    total_skus     = r_sku.scalar()  or 0
    products       = r_prods.scalars().all()
    overdue_count  = r_overdue.scalar() or 0
    yest_revenue   = r_yrev.scalar()  or 0
    yest_sold      = r_ysold.scalar() or 0
    sku_week       = r_sku_week.scalar() or 0
    recent_rows    = r_recent_sales.scalars().all()
    top_row        = r_top_today.first()

    # Build velocity map
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

    # Revenue vs yesterday %
    revenue_change_pct = None
    if yest_revenue > 0:
        revenue_change_pct = round((today_revenue - yest_revenue) / yest_revenue * 100, 1)

    # Items sold delta vs yesterday
    sold_change = int(sold_today - yest_sold) if yest_sold is not None else None

    # Alerts
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
    alerts.sort(key=lambda a: 0 if a["urgency"] == "critical" else 1)
    alerts = alerts[:6]
    if overdue_count:
        alerts.insert(0, {"type": "overdue_credit", "message": f"{overdue_count} credit sale(s) are overdue", "urgency": "critical"})

    # Recent activity feed
    recent_sales = [
        {
            "id": s.id,
            "reference": s.reference,
            "amount_pesawas": s.total_pesawas,
            "payment_method": s.payment_method,
            "created_at": s.created_at.isoformat(),
        }
        for s in recent_rows
    ]

    # Top product today
    top_product_today = None
    if top_row:
        top_product_today = {
            "name":  top_row.name,
            "emoji": top_row.emoji or "📦",
            "units": int(top_row.units),
            "revenue_pesawas": int(top_row.rev),
        }

    return {
        "shop_name": shop.name,
        "today_revenue_pesawas": today_revenue,
        "today_cash_pesawas": today_cash,
        "today_momo_pesawas": today_momo,
        "sold_today_count": int(sold_today),
        "sold_change": sold_change,
        "low_stock_count": len(low_stock_items),
        "avg_margin_pct": avg_margin,
        "total_skus": int(total_skus),
        "sku_change": int(sku_week),
        "revenue_change_pct": revenue_change_pct,
        "alerts": alerts,
        "recent_sales": recent_sales,
        "top_product_today": top_product_today,
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
    prev_cutoff = cutoff - timedelta(days=30)

    # Current period + previous period sales for trend
    curr_r, prev_r, items_r = await asyncio.gather(
        db.execute(
            select(Sale).where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
        ),
        db.execute(
            select(Sale).where(
                Sale.shop_id == shop.id,
                Sale.created_at >= prev_cutoff,
                Sale.created_at < cutoff,
            )
        ),
        db.execute(
            select(SaleItem, Product.buy_price_pesawas.label("buy_p"), Category.name.label("cat_name"))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
        ),
    )
    sales      = curr_r.scalars().all()
    prev_sales = prev_r.scalars().all()
    item_rows  = items_r.all()

    total      = sum(s.total_pesawas for s in sales)
    prev_total = sum(s.total_pesawas for s in prev_sales)
    count      = len(sales)

    # Profit change vs previous period
    profit_change_pct = 0.0
    if prev_total > 0:
        profit_change_pct = round((total - prev_total) / prev_total * 100, 1)

    # Gross profit and category breakdown
    gross_profit = 0
    cat_revenue: dict[str, int] = {}
    for row in item_rows:
        item = row[0]
        buy_p = row.buy_p or 0
        line_rev = item.unit_price_pesawas * item.quantity
        gross_profit += (item.unit_price_pesawas - buy_p) * item.quantity
        cat = row.cat_name or "Other"
        cat_revenue[cat] = cat_revenue.get(cat, 0) + line_rev

    # Category breakdown as percentages
    categories = []
    if total > 0:
        for cat, rev in sorted(cat_revenue.items(), key=lambda x: x[1], reverse=True)[:6]:
            categories.append({"name": cat, "pct": round(rev / total * 100, 1)})

    # Low-stock / overstock counts
    prods_r, vel_r = await asyncio.gather(
        db.execute(select(Product).where(Product.shop_id == shop.id)),
        db.execute(
            select(SaleItem.product_id, func.sum(SaleItem.quantity).label("qty"))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= cutoff)
            .group_by(SaleItem.product_id)
        ),
    )
    products = prods_r.scalars().all()
    vel_map  = {str(r.product_id): round(r.qty / 30, 2) for r in vel_r.all()}

    restock_count   = 0
    overstock_count = 0
    for p in products:
        velocity  = vel_map.get(str(p.id), 0.0)
        days_left = (p.current_stock / velocity) if velocity > 0 else 999
        if p.current_stock <= 5 or days_left <= 3:
            restock_count += 1
        elif velocity > 0 and days_left > 90:
            overstock_count += 1

    insight_text = "Record more sales to unlock insights."
    if count > 0:
        if profit_change_pct > 0:
            insight_text = f"Revenue is up {profit_change_pct:.0f}% vs last month. Top category: {categories[0]['name'] if categories else 'N/A'}."
        elif profit_change_pct < 0:
            insight_text = f"Revenue dipped {abs(profit_change_pct):.0f}% vs last month. Consider promotions on slow-moving stock."
        else:
            insight_text = f"{count} transactions this period. Keep scanning products to improve category analytics."

    return {
        "net_profit_pesawas": max(gross_profit, 0),
        "profit_change_pct": profit_change_pct,
        "total_revenue_pesawas": total,
        "gross_profit_pesawas": max(gross_profit, 0),
        "transactions": count,
        "avg_basket_pesawas": total // count if count else 0,
        "categories": categories,
        "insight_text": insight_text,
        "restock_count": restock_count,
        "overstock_count": overstock_count,
    }


@router.get("/daily-reconciliation")
async def daily_reconciliation(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    """
    Compares today's SaleItems (what was rung through the till) against
    StockMovements of type 'sale' (what was actually decremented from stock).
    Flags any product where the two numbers disagree.
    """
    _, shop = auth
    from app.models.inventory import StockMovement

    today       = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    today_end   = today_start + timedelta(days=1)

    sale_items_r, movements_r, products_r = await asyncio.gather(
        # Units sold per product today (from the POS till)
        db.execute(
            select(
                SaleItem.product_id,
                func.sum(SaleItem.quantity).label("units_sold"),
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(
                Sale.shop_id == shop.id,
                Sale.created_at >= today_start,
                Sale.created_at < today_end,
            )
            .group_by(SaleItem.product_id)
        ),
        # Stock decrements logged today (type='sale' from inventory module)
        db.execute(
            select(
                StockMovement.product_id,
                func.sum(StockMovement.quantity).label("moved_qty"),
            )
            .where(
                StockMovement.shop_id == shop.id,
                StockMovement.movement_type == "sale",
                StockMovement.created_at >= today_start,
                StockMovement.created_at < today_end,
            )
            .group_by(StockMovement.product_id)
        ),
        db.execute(
            select(Product.id, Product.name, Product.emoji, Product.current_stock)
            .where(Product.shop_id == shop.id)
        ),
    )

    sold_map    = {str(r.product_id): int(r.units_sold) for r in sale_items_r.all()}
    moved_map   = {str(r.product_id): int(r.moved_qty)  for r in movements_r.all()}
    product_map = {str(r.id): {"name": r.name, "emoji": r.emoji or "📦", "current_stock": r.current_stock}
                   for r in products_r.all()}

    all_product_ids = set(sold_map) | set(moved_map)
    items = []
    total_sold  = 0
    total_moved = 0
    discrepancy_count = 0

    for pid in sorted(all_product_ids):
        units_sold = sold_map.get(pid, 0)
        moved_qty  = moved_map.get(pid, 0)
        discrepancy = units_sold - moved_qty
        p = product_map.get(pid, {"name": "Unknown", "emoji": "📦", "current_stock": 0})

        total_sold  += units_sold
        total_moved += moved_qty
        if discrepancy != 0:
            discrepancy_count += 1

        items.append({
            "product_id":    pid,
            "name":          p["name"],
            "emoji":         p["emoji"],
            "current_stock": p["current_stock"],
            "units_sold":    units_sold,
            "stock_moved":   moved_qty,
            "discrepancy":   discrepancy,
            "flag":          discrepancy != 0,
        })

    # Sort flagged items first
    items.sort(key=lambda x: (not x["flag"], x["name"]))

    return {
        "date":    today.isoformat(),
        "items":   items,
        "summary": {
            "total_sold":         total_sold,
            "total_stock_moved":  total_moved,
            "total_discrepancy":  total_sold - total_moved,
            "discrepancy_count":  discrepancy_count,
        },
        "status": "discrepancy_found" if discrepancy_count > 0 else "balanced",
    }


@router.get("/morning-stock")
async def morning_stock(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    """
    Morning stock check — returns all products grouped by stock urgency.
    Designed to be viewed at 06:00 as a daily opening checklist.
    """
    _, shop = auth
    velocity_cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    prods_r, vel_r = await asyncio.gather(
        db.execute(
            select(Product, Category.name.label("cat_name"))
            .outerjoin(Category, Product.category_id == Category.id)
            .where(Product.shop_id == shop.id)
            .order_by(Product.name)
        ),
        db.execute(
            select(SaleItem.product_id, func.sum(SaleItem.quantity).label("qty"))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= velocity_cutoff)
            .group_by(SaleItem.product_id)
        ),
    )
    rows    = prods_r.all()
    vel_map = {str(r.product_id): round(r.qty / 30, 2) for r in vel_r.all()}

    critical, low, healthy = [], [], []

    for row in rows:
        p   = row[0]
        cat = row.cat_name or "Uncategorised"
        vel = vel_map.get(str(p.id), 0.0)
        days_left = round(p.current_stock / vel, 1) if vel > 0 else 999

        item = {
            "product_id":    str(p.id),
            "name":          p.name,
            "emoji":         p.emoji or "📦",
            "category":      cat,
            "current_stock": p.current_stock,
            "daily_velocity": vel,
            "days_remaining": days_left,
            "reorder_qty":   max(int(vel * 14), 10) if vel > 0 else 10,
        }

        if p.current_stock == 0 or days_left <= 2:
            critical.append(item)
        elif p.current_stock <= 5 or days_left <= 7:
            low.append(item)
        else:
            healthy.append(item)

    return {
        "date":           date.today().isoformat(),
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "critical_count": len(critical),
        "low_count":      len(low),
        "healthy_count":  len(healthy),
        "total_skus":     len(rows),
        "critical":       critical,
        "low":            low,
        "healthy":        healthy,
    }


@router.get("/eod-summary")
async def eod_summary(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    """
    End-of-day summary — today's sales performance, payment breakdown,
    stock movements, and a quick reconciliation flag.
    Designed to be viewed at 18:00 as a daily closing report.
    """
    from app.models.inventory import StockMovement

    _, shop = auth
    today       = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    today_end   = today_start + timedelta(days=1)

    sales_r, items_r, movements_r = await asyncio.gather(
        db.execute(
            select(Sale).where(Sale.shop_id == shop.id, Sale.created_at >= today_start, Sale.created_at < today_end)
        ),
        db.execute(
            select(
                SaleItem.product_id,
                func.sum(SaleItem.quantity).label("qty_sold"),
                func.sum(SaleItem.quantity * SaleItem.unit_price_pesawas).label("rev"),
                Product.name.label("product_name"),
                Product.emoji,
                Product.buy_price_pesawas,
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .where(Sale.shop_id == shop.id, Sale.created_at >= today_start, Sale.created_at < today_end)
            .group_by(SaleItem.product_id, Product.name, Product.emoji, Product.buy_price_pesawas)
            .order_by(func.sum(SaleItem.quantity * SaleItem.unit_price_pesawas).desc())
        ),
        db.execute(
            select(
                StockMovement.movement_type,
                func.sum(StockMovement.quantity).label("qty"),
            )
            .where(
                StockMovement.shop_id == shop.id,
                StockMovement.created_at >= today_start,
                StockMovement.created_at < today_end,
            )
            .group_by(StockMovement.movement_type)
        ),
    )
    sales     = sales_r.scalars().all()
    item_rows = items_r.all()
    mov_rows  = movements_r.all()

    total_revenue  = sum(s.total_pesawas for s in sales)
    cash_total     = sum(s.total_pesawas for s in sales if s.payment_method == "cash")
    momo_total     = sum(s.total_pesawas for s in sales if s.payment_method == "momo")
    credit_total   = sum(s.total_pesawas for s in sales if s.payment_method == "credit")
    tx_count       = len(sales)

    gross_profit = sum(
        (r.rev or 0) - (r.buy_price_pesawas or 0) * (r.qty_sold or 0)
        for r in item_rows
    )

    top_products = [
        {
            "product_id": str(r.product_id),
            "name":       r.product_name,
            "emoji":      r.emoji or "📦",
            "qty_sold":   int(r.qty_sold or 0),
            "revenue_pesawas": int(r.rev or 0),
        }
        for r in item_rows[:5]
    ]

    movement_summary = {r.movement_type: int(r.qty or 0) for r in mov_rows}
    units_sold_via_stock = movement_summary.get("sale", 0)
    units_sold_via_pos   = sum(r.qty_sold or 0 for r in item_rows)
    reconciliation_delta = int(units_sold_via_pos) - units_sold_via_stock

    return {
        "date":              today.isoformat(),
        "generated_at":      datetime.now(timezone.utc).isoformat(),
        "revenue_pesawas":   total_revenue,
        "gross_profit_pesawas": max(gross_profit, 0),
        "transactions":      tx_count,
        "avg_basket_pesawas": total_revenue // tx_count if tx_count else 0,
        "payment_breakdown": {
            "cash":   cash_total,
            "momo":   momo_total,
            "credit": credit_total,
        },
        "stock_movements":   movement_summary,
        "top_products":      top_products,
        "reconciliation": {
            "pos_units_sold":   int(units_sold_via_pos),
            "stock_units_moved": units_sold_via_stock,
            "delta":            reconciliation_delta,
            "status":           "balanced" if reconciliation_delta == 0 else "discrepancy_found",
        },
    }


@router.get("/retail-insights")
async def retail_insights(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    from sqlalchemy import cast, Date as SQLDate, extract

    week_start = datetime.now(timezone.utc) - timedelta(days=7)

    # ── Daily revenue for last 7 days ──────────────────────────────────────
    day_result = await db.execute(
        select(
            cast(Sale.created_at, SQLDate).label("sale_date"),
            func.sum(Sale.total_pesawas).label("rev"),
        )
        .where(Sale.shop_id == shop.id, Sale.created_at >= week_start)
        .group_by(cast(Sale.created_at, SQLDate))
    )
    rev_by_date = {str(row.sale_date): row.rev for row in day_result.all()}

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    daily_data = []
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        rev = rev_by_date.get(d.isoformat(), 0)
        daily_data.append({"label": day_names[d.weekday()], "value": rev})

    weekly_rev = sum(b["value"] for b in daily_data)

    # ── Weekly revenue for last 4 weeks ────────────────────────────────────
    four_weeks_ago = datetime.now(timezone.utc) - timedelta(days=28)
    week_result = await db.execute(
        select(Sale.created_at, Sale.total_pesawas)
        .where(Sale.shop_id == shop.id, Sale.created_at >= four_weeks_ago)
    )
    week_buckets: dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0}
    for row in week_result.all():
        days_ago = (datetime.now(timezone.utc) - row.created_at).days
        bucket = min(days_ago // 7, 3)
        week_buckets[3 - bucket] += row.total_pesawas
    weekly_data = [{"label": f"W-{3 - i}", "value": week_buckets[i]} for i in range(4)]

    # ── Gross profit estimate ──────────────────────────────────────────────
    profit_result = await db.execute(
        select(
            func.sum(
                (SaleItem.unit_price_pesawas - func.coalesce(Product.buy_price_pesawas, 0))
                * SaleItem.quantity
            ).label("profit")
        )
        .select_from(SaleItem)
        .join(Product, SaleItem.product_id == Product.id)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= week_start)
    )
    weekly_profit = profit_result.scalar() or 0

    # ── Peak trading times (hour-of-day buckets) ───────────────────────────
    hour_result = await db.execute(
        select(
            extract("hour", Sale.created_at).label("hr"),
            func.count(Sale.id).label("cnt"),
        )
        .where(Sale.shop_id == shop.id, Sale.created_at >= week_start)
        .group_by(extract("hour", Sale.created_at))
    )
    hour_rows = hour_result.all()
    total_tx = sum(r.cnt for r in hour_rows) or 1
    time_labels = {
        range(6, 12):  "Morning",
        range(12, 15): "Midday",
        range(15, 19): "Afternoon",
        range(19, 24): "Evening",
        range(0, 6):   "Night",
    }
    period_counts: dict[str, int] = {"Morning": 0, "Midday": 0, "Afternoon": 0, "Evening": 0, "Night": 0}
    for row in hour_rows:
        hr = int(row.hr)
        for r, label in time_labels.items():
            if hr in r:
                period_counts[label] += row.cnt
                break
    peak_times = [
        {"label": lbl, "pct": round((cnt / total_tx) * 100)}
        for lbl, cnt in period_counts.items() if cnt > 0
    ]

    # ── Top performing items ───────────────────────────────────────────────
    top_result = await db.execute(
        select(
            Product.id, Product.name, Product.emoji,
            Product.buy_price_pesawas, Product.sell_price_pesawas,
            func.sum(SaleItem.quantity).label("qty_sold"),
        )
        .select_from(SaleItem)
        .join(Product, SaleItem.product_id == Product.id)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.shop_id == shop.id, Sale.created_at >= week_start)
        .group_by(Product.id, Product.name, Product.emoji, Product.buy_price_pesawas, Product.sell_price_pesawas)
        .order_by(func.sum(SaleItem.quantity * SaleItem.unit_price_pesawas).desc())
        .limit(5)
    )
    top_items = []
    for row in top_result.all():
        buy = row.buy_price_pesawas or 1
        margin_pct = ((row.sell_price_pesawas - buy) / buy) * 100 if buy else 0
        margin = "high" if margin_pct >= 30 else "fair" if margin_pct >= 10 else "low"
        top_items.append({"name": row.name, "emoji": row.emoji or "📦", "margin": margin})

    # ── Low-stock warning ──────────────────────────────────────────────────
    low_result = await db.execute(
        select(func.count(Product.id))
        .where(Product.shop_id == shop.id, Product.current_stock <= 3)
    )
    low_count = low_result.scalar() or 0
    stock_warning = f"{low_count} products running critically low — reorder soon" if low_count > 0 else ""

    return {
        "weekly_revenue_pesawas": weekly_rev,
        "weekly_profit_pesawas": int(weekly_profit),
        "daily_data": daily_data,
        "weekly_data": weekly_data,
        "peak_times": peak_times,
        "top_items": top_items,
        "stock_warning": stock_warning,
    }
