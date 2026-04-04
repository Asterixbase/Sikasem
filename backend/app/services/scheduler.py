"""
Sikasem daily job scheduler.

Runs at 08:00 Africa/Accra every morning:
  1. Auto-collect: fire MoMo request for every pending credit sale due today or overdue
  2. Auto-flag:    mark credit sales as 'overdue' when past due_date and still 'pending'

APScheduler is started/stopped in main.py lifespan.
"""
import logging
import uuid
from datetime import date, datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import AsyncSessionLocal as async_session_factory
from app.models.credit import CreditCustomer, CreditSale, CreditCollection
from app.services.momo import request_to_pay

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Africa/Accra")


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


def start_scheduler() -> None:
    scheduler.add_job(
        _daily_credit_collection,
        trigger=CronTrigger(hour=8, minute=0, timezone="Africa/Accra"),
        id="daily_credit_collection",
        replace_existing=True,
        misfire_grace_time=3600,  # run up to 1 hour late if server was down
    )
    scheduler.start()
    logger.info("[scheduler] started — daily collection at 08:00 Africa/Accra")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[scheduler] stopped")
