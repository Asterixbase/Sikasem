"""
Transactions search router
GET /v1/transactions/search
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.sale import Sale
from app.models.credit import CreditSale
from app.models.vault import VaultPayout
from app.schemas.sale import SearchResponse

router = APIRouter()


@router.get("", response_model=SearchResponse)
async def search_transactions(
    q: str = Query(default=""),
    type: str = Query(default="all"),
    from_: str = Query(default="", alias="from"),
    to: str = Query(default=""),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    results = []

    if type in ("all", "sales"):
        sale_result = await db.execute(
            select(Sale).where(Sale.shop_id == shop.id).order_by(Sale.created_at.desc()).limit(50)
        )
        for s in sale_result.scalars().all():
            if q and q.lower() not in s.reference.lower():
                continue
            results.append({
                "id": s.id,
                "type": "sale",
                "description": f"Sale #{s.reference}",
                "date": s.created_at.isoformat(),
                "amount_pesawas": s.total_pesawas,
                "status": "completed",
            })

    if type in ("all", "credits"):
        credit_result = await db.execute(
            select(CreditSale).where(CreditSale.shop_id == shop.id).order_by(CreditSale.created_at.desc()).limit(50)
        )
        for c in credit_result.scalars().all():
            if q and q.lower() not in c.reference.lower():
                continue
            results.append({
                "id": c.id,
                "type": "credit",
                "description": f"Credit #{c.reference}",
                "date": c.created_at.isoformat(),
                "amount_pesawas": c.amount_pesawas,
                "status": c.status,
            })

    if type in ("all", "payouts"):
        payout_result = await db.execute(
            select(VaultPayout).where(VaultPayout.shop_id == shop.id).order_by(VaultPayout.created_at.desc()).limit(20)
        )
        for p in payout_result.scalars().all():
            results.append({
                "id": p.id,
                "type": "payout",
                "description": f"Payout to {p.recipient_phone}",
                "date": p.created_at.isoformat(),
                "amount_pesawas": p.amount_pesawas,
                "status": p.status,
            })

    results.sort(key=lambda r: r["date"], reverse=True)

    return SearchResponse(
        results=results[:100],
        recent_searches=[],
        quick_insights={"total_results": len(results)},
    )
