"""
Sikasem daily job scheduler.

Scheduled jobs (all Africa/Accra timezone):
  06:00 — Morning stock check push notification (critical/low counts per shop)
  08:00 — Auto-collect MoMo for pending/overdue credit sales
  18:00 — End-of-day report push notification (revenue + reconciliation status)

APScheduler is started/stopped in main.py lifespan.
"""
import logging
import uuid
from datetime import date, datetime, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import AsyncSessionLocal as async_session_factory
from app.models.credit import CreditCustomer, CreditSale, CreditCollection
from app.models.notification import PushToken
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.services.momo import request_to_pay

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Africa/Accra")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _send_expo_notifications(messages: list[dict]) -> None:
    """Fire-and-forget: POST a batch of Expo push messages."""
    if not messages:
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Accept": "application/json", "Accept-Encoding": "gzip, deflate"},
            )
    except Exception as exc:
        logger.warning("[push] failed to send notifications: %s", exc)


async def _daily_credit_collection() -> None:
    """
    Fired at 08:00 Africa/Accra.
    For every shop:
      - Mark pending sales past due_date as 'overdue'
      - Fire MoMo request for all due/overdue sales that have a momo_phone
    """
    logger.info("[scheduler] daily_credit_collection starting")

    async with async_session_factory() as db:
        today = date.today()

        # ── 1. Auto-flag overdue ──────────────────────────────────────────
        result = await db.execute(
            select(CreditSale).where(
                CreditSale.status == "pending",
                CreditSale.due_date < today,
            )
        )
        overdue_sales = result.scalars().all()
        for cs in overdue_sales:
            cs.status = "overdue"
            logger.info("[scheduler] flagged overdue: %s", cs.reference)

        if overdue_sales:
            await db.flush()

        # ── 2. Auto-collect: due today or already overdue ─────────────────
        collect_result = await db.execute(
            select(CreditSale).where(
                CreditSale.status.in_(["pending", "overdue"]),
                CreditSale.due_date <= today,
            )
        )
        due_sales = collect_result.scalars().all()

        collected = 0
        for cs in due_sales:
            customer = await db.get(CreditCustomer, cs.customer_id)
            if not customer:
                continue
            phone = customer.momo_phone or customer.phone
            if not phone:
                continue

            try:
                result = await request_to_pay(cs.amount_pesawas, phone, cs.reference)
                col = CreditCollection(
                    id=str(uuid.uuid4()),
                    credit_sale_id=cs.id,
                    amount_pesawas=cs.amount_pesawas,
                    status="pending",
                    network="mtn",
                    external_ref=result.get("external_ref"),
                )
                db.add(col)
                cs.momo_queued_at = datetime.now(timezone.utc)
                collected += 1
                logger.info(
                    "[scheduler] queued MoMo request for %s (%s)",
                    cs.reference, phone,
                )
            except Exception as exc:
                # Log but don't crash the job — other customers still need collecting
                logger.warning(
                    "[scheduler] MoMo request failed for %s: %s",
                    cs.reference, exc,
                )

        await db.commit()
        logger.info(
            "[scheduler] daily_credit_collection done — "
            "flagged overdue: %d, MoMo queued: %d",
            len(overdue_sales), collected,
        )


async def _morning_stock_notification() -> None:
    """
    Fired at 06:00 Africa/Accra.
    For each shop that has registered push tokens, send a morning stock check summary.
    """
    logger.info("[scheduler] morning_stock_notification starting")
    today = date.today()

    async with async_session_factory() as db:
        # Get all shops with push tokens
        token_result = await db.execute(select(PushToken))
        all_tokens = token_result.scalars().all()

        # Group by shop_id
        shop_tokens: dict[str, list[str]] = {}
        for t in all_tokens:
            shop_tokens.setdefault(t.shop_id, []).append(t.token)

        messages = []
        for shop_id, tokens in shop_tokens.items():
            # Count critical products (stock = 0 or days_remaining ≤ 2)
            result = await db.execute(
                select(Product).where(
                    Product.shop_id == shop_id,
                    Product.is_active == True,
                )
            )
            products = result.scalars().all()
            critical = sum(1 for p in products if p.current_stock == 0)
            low = sum(1 for p in products if 0 < p.current_stock <= 5)
            total = len(products)

            if critical > 0:
                body = f"{critical} product{'s' if critical > 1 else ''} out of stock · {low} low"
                title = "⚠️ Morning Stock Check"
            elif low > 0:
                body = f"{low} product{'s' if low > 1 else ''} running low — reorder soon"
                title = "📦 Morning Stock Check"
            else:
                body = f"All {total} products fully stocked — good day ahead!"
                title = "✅ Morning Stock Check"

            for token in tokens:
                messages.append({
                    "to": token,
                    "title": title,
                    "body": body,
                    "data": {"screen": "daily-reports", "tab": "stock"},
                    "sound": "default",
                })

        await _send_expo_notifications(messages)
        logger.info(
            "[scheduler] morning_stock_notification done — %d shops, %d messages",
            len(shop_tokens), len(messages),
        )


async def _daily_shopkeeper_briefing() -> None:
    """
    Fired at 06:30 Africa/Accra.
    Per shop: yesterday revenue vs same weekday last week + top 3 margin products to push today.
    """
    logger.info("[scheduler] daily_shopkeeper_briefing starting")
    today = date.today()
    yesterday = today - timedelta(days=1)
    same_day_last_week = today - timedelta(days=7)

    async with async_session_factory() as db:
        token_result = await db.execute(select(PushToken))
        all_tokens = token_result.scalars().all()

        shop_tokens: dict[str, list[str]] = {}
        for t in all_tokens:
            shop_tokens.setdefault(t.shop_id, []).append(t.token)

        messages = []
        for shop_id, tokens in shop_tokens.items():
            # Yesterday revenue
            yest_result = await db.execute(
                select(func.sum(Sale.total_pesawas)).where(
                    Sale.shop_id == shop_id,
                    func.date(Sale.created_at) == yesterday,
                )
            )
            yest_revenue = yest_result.scalar() or 0

            # Same weekday last week
            week_ago_result = await db.execute(
                select(func.sum(Sale.total_pesawas)).where(
                    Sale.shop_id == shop_id,
                    func.date(Sale.created_at) == same_day_last_week,
                )
            )
            week_ago_revenue = week_ago_result.scalar() or 0

            if week_ago_revenue > 0:
                pct = round((yest_revenue - week_ago_revenue) / week_ago_revenue * 100)
                trend = f"{'+' if pct >= 0 else ''}{pct}% vs last {yesterday.strftime('%A')}"
            else:
                trend = "first data point"

            # Top 3 in-stock products by margin %
            products_result = await db.execute(
                select(Product).where(
                    Product.shop_id == shop_id,
                    Product.is_active == True,
                    Product.current_stock > 0,
                    Product.buy_price_pesawas > 0,
                ).order_by(
                    ((Product.sell_price_pesawas - Product.buy_price_pesawas)).desc()
                ).limit(3)
            )
            top_products = products_result.scalars().all()
            top_names = ", ".join(p.name for p in top_products) if top_products else "Check inventory"

            yest_ghs = yest_revenue / 100
            body = f"Yesterday: GHS {yest_ghs:.0f} ({trend})\nPush today: {top_names}"

            for token in tokens:
                messages.append({
                    "to": token,
                    "title": "☀️ Good morning — Shopkeeper Briefing",
                    "body": body,
                    "data": {"screen": "daily-reports"},
                    "sound": "default",
                })

        await _send_expo_notifications(messages)
        logger.info(
            "[scheduler] daily_shopkeeper_briefing done — %d shops, %d messages",
            len(shop_tokens), len(messages),
        )


async def _eod_report_notification() -> None:
    """
    Fired at 18:00 Africa/Accra.
    For each shop with push tokens, send an EOD revenue + reconciliation summary.
    """
    logger.info("[scheduler] eod_report_notification starting")
    today = date.today()

    async with async_session_factory() as db:
        token_result = await db.execute(select(PushToken))
        all_tokens = token_result.scalars().all()

        shop_tokens: dict[str, list[str]] = {}
        for t in all_tokens:
            shop_tokens.setdefault(t.shop_id, []).append(t.token)

        messages = []
        for shop_id, tokens in shop_tokens.items():
            # Total revenue today
            sales_result = await db.execute(
                select(func.sum(Sale.total_pesawas), func.count(Sale.id)).where(
                    Sale.shop_id == shop_id,
                    func.date(Sale.created_at) == today,
                )
            )
            total_pesawas, tx_count = sales_result.one()
            total_pesawas = total_pesawas or 0
            tx_count = tx_count or 0

            revenue_ghs = total_pesawas / 100
            body = (
                f"GHS {revenue_ghs:.2f} revenue · {tx_count} transaction{'s' if tx_count != 1 else ''}"
                " — tap to view full report"
            )

            for token in tokens:
                messages.append({
                    "to": token,
                    "title": "📊 End of Day Report",
                    "body": body,
                    "data": {"screen": "daily-reports", "tab": "eod"},
                    "sound": "default",
                })

        await _send_expo_notifications(messages)
        logger.info(
            "[scheduler] eod_report_notification done — %d shops, %d messages",
            len(shop_tokens), len(messages),
        )


def start_scheduler() -> None:
    scheduler.add_job(
        _morning_stock_notification,
        trigger=CronTrigger(hour=6, minute=0, timezone="Africa/Accra"),
        id="morning_stock_notification",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        _daily_shopkeeper_briefing,
        trigger=CronTrigger(hour=6, minute=30, timezone="Africa/Accra"),
        id="daily_shopkeeper_briefing",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        _daily_credit_collection,
        trigger=CronTrigger(hour=8, minute=0, timezone="Africa/Accra"),
        id="daily_credit_collection",
        replace_existing=True,
        misfire_grace_time=3600,  # run up to 1 hour late if server was down
    )
    scheduler.add_job(
        _eod_report_notification,
        trigger=CronTrigger(hour=18, minute=0, timezone="Africa/Accra"),
        id="eod_report_notification",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info(
        "[scheduler] started — stock @06:00, briefing @06:30, credit @08:00, EOD @18:00 (Africa/Accra)"
    )


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[scheduler] stopped")
