"""
AI router
POST /v1/ai/chat          – conversational shop assistant (Sika)
GET  /v1/ai/shift-summary – WA-ready end-of-day handover message
"""
import logging
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.deps import get_current_shop
from app.core.database import get_db
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.credit import CreditSale

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


async def _shop_snapshot(db: AsyncSession, shop_id: str) -> str:
    """Build a short text snapshot of the shop's current state."""
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)

    rev_r = await db.execute(
        select(func.sum(Sale.total_pesawas))
        .where(Sale.shop_id == shop_id, Sale.created_at >= today_start)
    )
    today_rev = (rev_r.scalar() or 0) / 100

    count_r = await db.execute(
        select(func.count(Sale.id))
        .where(Sale.shop_id == shop_id, Sale.created_at >= today_start)
    )
    sale_count = count_r.scalar() or 0

    low_r = await db.execute(
        select(Product.name, Product.stock_qty, Product.reorder_point)
        .where(
            Product.shop_id == shop_id,
            Product.stock_qty <= Product.reorder_point,
            Product.is_active == True,
        )
        .order_by(Product.stock_qty.asc())
        .limit(5)
    )
    low_stock = low_r.all()

    top_r = await db.execute(
        select(
            Product.name,
            func.sum(SaleItem.quantity).label("units"),
            func.sum(SaleItem.subtotal_pesawas).label("rev"),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.shop_id == shop_id, Sale.created_at >= today_start)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(SaleItem.subtotal_pesawas).desc())
        .limit(3)
    )
    top_products = top_r.all()

    credit_r = await db.execute(
        select(func.sum(CreditSale.amount_pesawas))
        .where(CreditSale.shop_id == shop_id, CreditSale.status == "pending")
    )
    credit_total = (credit_r.scalar() or 0) / 100

    lines = [
        f"Today: GHS {today_rev:.2f} revenue from {sale_count} sales",
        f"Outstanding credit: GHS {credit_total:.2f}",
    ]
    if top_products:
        lines.append(
            "Top sellers today: "
            + ", ".join(f"{r.name} ({r.units} units)" for r in top_products)
        )
    if low_stock:
        lines.append(
            "Low stock: "
            + ", ".join(f"{r.name} (qty: {r.stock_qty})" for r in low_stock)
        )

    return "\n".join(lines)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    import anthropic
    from app.core.config import settings

    if not getattr(settings, "ANTHROPIC_API_KEY", None):
        raise HTTPException(status_code=503, detail="AI assistant not configured")

    _, shop = auth
    snapshot = await _shop_snapshot(db, shop.id)
    shop_name = getattr(shop, "name", None) or "this shop"

    system_prompt = (
        f"You are Sika, an AI shop assistant for {shop_name} in Ghana.\n"
        "You help the shopkeeper with questions about inventory, sales, and customers.\n"
        "Keep answers short (2-4 sentences) and practical. Use GHS for currency.\n"
        "No markdown formatting — plain text only.\n\n"
        f"Current shop snapshot:\n{snapshot}"
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages = [{"role": m.role, "content": m.content} for m in body.history]
    messages.append({"role": "user", "content": body.message})

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            system=system_prompt,
            messages=messages,
        )
        reply = response.content[0].text
    except Exception as exc:
        logger.warning("[ai/chat] Claude call failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI response failed")

    return {"reply": reply}


@router.get("/shift-summary")
async def shift_summary(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    import anthropic
    from app.core.config import settings

    if not getattr(settings, "ANTHROPIC_API_KEY", None):
        raise HTTPException(status_code=503, detail="AI assistant not configured")

    _, shop = auth
    today = date.today()
    today_str = today.strftime("%A %d %B %Y")
    shop_name = getattr(shop, "name", None) or "the shop"
    snapshot = await _shop_snapshot(db, shop.id)

    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    pm_r = await db.execute(
        select(Sale.payment_method, func.sum(Sale.total_pesawas))
        .where(Sale.shop_id == shop.id, Sale.created_at >= today_start)
        .group_by(Sale.payment_method)
    )
    pm_breakdown = {row[0]: row[1] / 100 for row in pm_r.all()}
    pm_lines = " | ".join(
        f"{k.upper()}: GHS {v:.2f}" for k, v in pm_breakdown.items()
    ) or "No sales yet"

    prompt = (
        f"Write a short WhatsApp shift handover message for {shop_name} on {today_str}.\n"
        "Keep it under 10 lines. Use WhatsApp formatting (*bold*, emojis).\n"
        "Include: total revenue, payment breakdown, top sellers, any low-stock warnings.\n"
        "End with a short motivational line.\n\n"
        f"Shop data:\n{snapshot}\n"
        f"Payment breakdown: {pm_lines}"
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        summary = response.content[0].text
    except Exception as exc:
        logger.warning("[ai/shift-summary] Claude call failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI response failed")

    return {"summary": summary, "date": today_str}
