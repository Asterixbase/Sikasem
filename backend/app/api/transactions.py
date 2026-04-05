"""
Transactions search router
GET /v1/transactions/search

Searches across:
  - Sales: matches sale reference OR any product name in the sale's line items
  - Credits: matches reference or customer name
  - Payouts: matches recipient phone
  - Stock-In: stock adjustment logs (via inventory_logs)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.sale import Sale, SaleItem
from app.models.product import Product
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
    q_lower = q.strip().lower()

    if type in ("all", "sales"):
        if q_lower:
            # Find sale IDs that contain a matching product name
            matching_sale_ids_result = await db.execute(
                select(SaleItem.sale_id)
                .join(Product, SaleItem.product_id == Product.id)
                .where(
                    Product.shop_id == shop.id,
                    func.lower(Product.name).contains(q_lower),
                )
            )
            matched_ids = {str(r[0]) for r in matching_sale_ids_result.all()}

            sale_result = await db.execute(
                select(Sale)
                .where(Sale.shop_id == shop.id)
                .order_by(Sale.created_at.desc())
                .limit(200)
            )
            for s in sale_result.scalars().all():
                # Match by reference OR by product name within line items
                if q_lower not in s.reference.lower() and s.id not in matched_ids:
                    continue
                results.append({
                    "id": s.id,
                    "type": "sale",
                    "description": f"Sale #{s.reference}",
                    "date": s.created_at.isoformat(),
                    "amount_pesawas": s.total_pesawas,
                    "payment_method": s.payment_method,
                    "status": "completed",
                })
        else:
            # No query — return recent sales
            sale_result = await db.execute(
                select(Sale)
                .where(Sale.shop_id == shop.id)
                .order_by(Sale.created_at.desc())
                .limit(50)
            )
            for s in sale_result.scalars().all():
                results.append({
                    "id": s.id,
                    "type": "sale",
                    "description": f"Sale #{s.reference}",
                    "date": s.created_at.isoformat(),
                    "amount_pesawas": s.total_pesawas,
                    "payment_method": s.payment_method,
                    "status": "completed",
                })

    if type in ("all", "credits"):
        credit_result = await db.execute(
            select(CreditSale).where(CreditSale.shop_id == shop.id).order_by(CreditSale.created_at.desc()).limit(50)
        )
        for c in credit_result.scalars().all():
            desc = f"Credit #{c.reference}"
            if hasattr(c, 'customer_name') and c.customer_name:
                desc = f"Credit — {c.customer_name}"
            if q_lower and q_lower not in desc.lower() and q_lower not in c.reference.lower():
                continue
            results.append({
                "id": c.id,
                "type": "credit",
                "description": desc,
                "date": c.created_at.isoformat(),
                "amount_pesawas": c.amount_pesawas,
                "payment_method": "credit",
                "status": c.status,
            })

    if type in ("all", "payouts"):
        payout_result = await db.execute(
            select(VaultPayout).where(VaultPayout.shop_id == shop.id).order_by(VaultPayout.created_at.desc()).limit(20)
        )
        for p in payout_result.scalars().all():
            desc = f"Payout → {p.recipient_phone}"
            if q_lower and q_lower not in desc.lower():
                continue
            results.append({
                "id": p.id,
                "type": "payout",
                "description": desc,
                "date": p.created_at.isoformat(),
                "amount_pesawas": p.amount_pesawas,
                "payment_method": "momo",
                "status": p.status,
            })

    results.sort(key=lambda r: r["date"], reverse=True)

    return SearchResponse(
        results=results[:100],
        recent_searches=[],
        quick_insights={"total_results": len(results)},
    )
