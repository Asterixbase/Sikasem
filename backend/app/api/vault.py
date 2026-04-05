"""
Treasury router (formerly Vault)
GET  /v1/treasury/balance
POST /v1/treasury/payout
GET  /v1/treasury/payouts

All endpoints require role=owner. Managers and staff receive 403.
"""
import uuid
from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import require_owner
from app.models.sale import Sale
from app.models.credit import CreditCollection
from app.models.vault import VaultPayout
from app.schemas.vault import VaultPayoutRequest, VaultPayoutResponse, VaultBalanceResponse, PayoutHistoryResponse
from app.services.momo import transfer

router = APIRouter()


@router.get("/balance", response_model=VaultBalanceResponse)
async def vault_balance(
    auth=Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    # Total MoMo collections received
    momo_result = await db.execute(
        select(func.sum(Sale.total_pesawas)).where(
            Sale.shop_id == shop.id,
            Sale.payment_method == "momo",
        )
    )
    momo_total = momo_result.scalar() or 0

    # Total paid out
    payout_result = await db.execute(
        select(func.sum(VaultPayout.amount_pesawas)).where(
            VaultPayout.shop_id == shop.id,
            VaultPayout.status == "success",
        )
    )
    paid_out = payout_result.scalar() or 0

    # Today change
    today_result = await db.execute(
        select(func.sum(Sale.total_pesawas)).where(
            Sale.shop_id == shop.id,
            Sale.payment_method == "momo",
            Sale.created_at >= today_start,
        )
    )
    today_change = today_result.scalar() or 0

    available = momo_total - paid_out

    # Recent activity — MoMo sales + payouts merged, newest first
    recent_momo = await db.execute(
        select(Sale).where(
            Sale.shop_id == shop.id,
            Sale.payment_method == "momo",
        ).order_by(Sale.created_at.desc()).limit(8)
    )
    activity = []
    for s in recent_momo.scalars().all():
        activity.append({
            "id": s.id,
            "type": "collection",
            "description": f"MoMo collection — {s.reference}",
            "amount_pesawas": s.total_pesawas,
            "time": s.created_at.strftime("%d/%m/%Y %H:%M"),
        })

    recent_payouts = await db.execute(
        select(VaultPayout).where(VaultPayout.shop_id == shop.id)
        .order_by(VaultPayout.created_at.desc()).limit(4)
    )
    for p in recent_payouts.scalars().all():
        activity.append({
            "id": p.id,
            "type": "payout",
            "description": f"Payout — {p.recipient_phone}",
            "amount_pesawas": -p.amount_pesawas,
            "time": p.created_at.strftime("%d/%m/%Y %H:%M"),
        })
    # Sort combined list newest first (parse time string or just keep order)
    activity = activity[:10]

    return VaultBalanceResponse(
        total_pesawas=momo_total,
        available_payout_pesawas=max(available, 0),
        momo_collections_pesawas=momo_total,
        today_change_pesawas=today_change,
        recent_activity=activity,
    )


@router.post("/payout", response_model=VaultPayoutResponse)
async def vault_payout(
    body: VaultPayoutRequest,
    auth=Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await transfer(body.amount_pesawas, body.recipient_phone, body.network)
    fee = result.get("fee_pesawas", 0)

    payout = VaultPayout(
        id=str(uuid.uuid4()),
        shop_id=shop.id,
        amount_pesawas=body.amount_pesawas,
        recipient_phone=body.recipient_phone,
        network=body.network,
        status=result.get("status", "pending"),
        fee_pesawas=fee,
        external_ref=result.get("external_ref"),
    )
    db.add(payout)
    await db.commit()

    return VaultPayoutResponse(
        payout_id=payout.id,
        status=payout.status,
        recipient_name=result.get("recipient_name"),
        amount_pesawas=body.amount_pesawas,
        fee_pesawas=fee,
    )


@router.get("/payouts", response_model=PayoutHistoryResponse)
async def payout_history(
    limit: int = Query(default=20, le=100),
    auth=Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(VaultPayout)
        .where(VaultPayout.shop_id == shop.id)
        .order_by(VaultPayout.created_at.desc())
        .limit(limit)
    )
    payouts = result.scalars().all()

    total = sum(p.amount_pesawas for p in payouts if p.status == "success")

    return PayoutHistoryResponse(
        total_paid_out_pesawas=total,
        trend_pct=0.0,
        period="30d",
        payouts=[
            {
                "id": p.id,
                "initials": (p.recipient_name or p.recipient_phone)[:2].upper(),
                "name": p.recipient_name or p.recipient_phone,
                "phone": p.recipient_phone,
                "network": p.network,
                "date": p.created_at.strftime("%d %b %Y"),
                "time": p.created_at.strftime("%I:%M %p"),
                "amount_pesawas": p.amount_pesawas,
                "status": p.status,
            }
            for p in payouts
        ],
    )
