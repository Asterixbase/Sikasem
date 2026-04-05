"""
Credit router
POST /v1/credit/customers
POST /v1/credit/sales
GET  /v1/credit/sales
GET  /v1/credit/sales/{id}
PATCH /v1/credit/sales/{id}/status
POST /v1/credit/sales/{id}/momo-request
POST /v1/credit/sales/{id}/whatsapp
GET  /v1/credit/collections
"""
import uuid
from datetime import datetime, date, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.credit import CreditCustomer, CreditSale, CreditSaleItem, CreditCollection
from app.models.product import Product
from app.schemas.credit import (
    CreditCustomerCreate, CreditCustomerOut,
    CreditSaleCreate, CreditSaleOut,
    CreditStatusUpdate, WhatsAppResponse,
    CollectionItem, CollectionsResponse,
)
from app.services.momo import request_to_pay

router = APIRouter()


def _ref() -> str:
    import random, string
    return "CR" + "".join(random.choices(string.digits, k=8))


def _initials(name: str) -> str:
    parts = name.strip().split()
    return "".join(p[0].upper() for p in parts[:2]) if parts else "??"


@router.post("/customers", response_model=CreditCustomerOut, status_code=201)
async def create_customer(
    body: CreditCustomerCreate,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    customer = CreditCustomer(
        id=str(uuid.uuid4()),
        shop_id=shop.id,
        full_name=body.full_name,
        id_type=body.id_type,
        id_number=body.id_number,
        phone=body.phone,
        momo_phone=body.momo_phone,
    )
    db.add(customer)
    await db.commit()
    return CreditCustomerOut(
        customer_id=customer.id,
        full_name=customer.full_name,
        phone_e164=customer.phone,
        created=customer.created_at.isoformat(),
    )


@router.post("/sales", response_model=CreditSaleOut, status_code=201)
async def create_credit_sale(
    body: CreditSaleCreate,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    customer = await db.get(CreditCustomer, body.customer_id)
    if not customer or customer.shop_id != shop.id:
        raise HTTPException(status_code=404, detail="Customer not found")

    cs_id = str(uuid.uuid4())
    cs = CreditSale(
        id=cs_id,
        shop_id=shop.id,
        customer_id=body.customer_id,
        reference=_ref(),
        amount_pesawas=body.amount_pesawas,
        due_date=date.fromisoformat(body.due_date),
        status="pending",
    )
    db.add(cs)

    for item in body.items:
        csi = CreditSaleItem(
            id=str(uuid.uuid4()),
            credit_sale_id=cs_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price_pesawas=item.unit_price_pesawas,
        )
        db.add(csi)

    if body.momo_auto_request and customer.momo_phone:
        await request_to_pay(body.amount_pesawas, customer.momo_phone, cs.reference)
        cs.momo_queued_at = datetime.now(timezone.utc)
        collection = CreditCollection(
            id=str(uuid.uuid4()),
            credit_sale_id=cs_id,
            amount_pesawas=body.amount_pesawas,
            status="pending",
            network="mtn",
        )
        db.add(collection)

    await db.commit()
    return CreditSaleOut(
        credit_sale_id=cs.id,
        reference=cs.reference,
        amount_pesawas=cs.amount_pesawas,
        due_date=cs.due_date.isoformat(),
        status=cs.status,
        customer_name=customer.full_name,
        customer_phone=customer.phone,
        momo_queued_at=cs.momo_queued_at.isoformat() if cs.momo_queued_at else None,
    )


def _compute_status(cs: CreditSale) -> str:
    """Derive display status from stored status + due date."""
    if cs.status in ("paid", "written_off"):
        return cs.status
    today = date.today()
    tomorrow = today + timedelta(days=1)
    if cs.due_date < today:
        return "overdue"
    if cs.due_date == tomorrow:
        return "due_tomorrow"
    return "pending"


@router.get("/sales")
async def list_credit_sales(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(CreditSale).where(CreditSale.shop_id == shop.id).order_by(CreditSale.created_at.desc())
    )
    sales = result.scalars().all()
    out = []
    for cs in sales:
        customer = await db.get(CreditCustomer, cs.customer_id)
        out.append({
            "id": cs.id,
            "credit_sale_id": cs.id,
            "reference": cs.reference,
            "amount_pesawas": cs.amount_pesawas,
            "due_date": cs.due_date.isoformat(),
            "status": _compute_status(cs),
            "customer_name": customer.full_name if customer else "",
            "customer_phone": customer.phone if customer else "",
            "initials": _initials(customer.full_name) if customer else "??",
            "momo_queued_at": cs.momo_queued_at.isoformat() if cs.momo_queued_at else None,
        })
    return out


@router.get("/sales/{credit_sale_id}")
async def get_credit_sale(
    credit_sale_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    cs = await db.get(CreditSale, credit_sale_id)
    if not cs or cs.shop_id != shop.id:
        raise HTTPException(status_code=404, detail="Credit sale not found")
    customer = await db.get(CreditCustomer, cs.customer_id)
    return {
        "id": cs.id,
        "credit_sale_id": cs.id,
        "reference": cs.reference,
        "amount_pesawas": cs.amount_pesawas,
        "due_date": cs.due_date.isoformat(),
        "status": _compute_status(cs),
        "customer_name": customer.full_name if customer else "",
        "customer_phone": customer.phone if customer else "",
        "momo_phone": customer.momo_phone if customer else None,
        "id_type": customer.id_type if customer else None,
        "initials": _initials(customer.full_name) if customer else "??",
        "momo_queued_at": cs.momo_queued_at.isoformat() if cs.momo_queued_at else None,
        "created_at": cs.created_at.isoformat() if cs.created_at else None,
    }


@router.patch("/sales/{credit_sale_id}/status")
async def update_credit_status(
    credit_sale_id: str,
    body: CreditStatusUpdate,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    cs = await db.get(CreditSale, credit_sale_id)
    if not cs or cs.shop_id != shop.id:
        raise HTTPException(status_code=404, detail="Credit sale not found")

    prev_status = cs.status
    cs.status = body.status
    await db.commit()

    # When marking paid, build WhatsApp confirmation URL
    wa_url = None
    if body.status == "paid" and prev_status != "paid":
        customer = await db.get(CreditCustomer, cs.customer_id)
        if customer:
            amount_ghs = cs.amount_pesawas / 100
            paid_date = datetime.now(timezone.utc).strftime("%d/%m/%Y")
            msg = (
                f"Dear {customer.full_name}, your credit payment of GHS {amount_ghs:.2f} "
                f"(Ref: {cs.reference}) has been received on {paid_date}. "
                f"Thank you for your prompt payment! — {shop.name}"
            )
            wa_phone = (customer.phone or "").replace("+", "").replace(" ", "")
            wa_url = f"https://wa.me/{wa_phone}?text={msg.replace(' ', '%20')}"

    return {"credit_sale_id": cs.id, "status": cs.status, "wa_confirmation_url": wa_url}


@router.post("/sales/{credit_sale_id}/momo-request")
async def momo_request(
    credit_sale_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    cs = await db.get(CreditSale, credit_sale_id)
    if not cs or cs.shop_id != shop.id:
        raise HTTPException(status_code=404, detail="Credit sale not found")
    customer = await db.get(CreditCustomer, cs.customer_id)
    phone = customer.momo_phone or customer.phone if customer else None
    if not phone:
        raise HTTPException(status_code=400, detail="No MoMo phone on file")
    result = await request_to_pay(cs.amount_pesawas, phone, cs.reference)
    cs.momo_queued_at = datetime.now(timezone.utc)
    col = CreditCollection(
        id=str(uuid.uuid4()),
        credit_sale_id=cs.id,
        amount_pesawas=cs.amount_pesawas,
        status="pending",
        network="mtn",
        external_ref=result.get("external_ref"),
    )
    db.add(col)
    await db.commit()
    return {"status": "queued", "external_ref": result.get("external_ref")}


@router.post("/sales/{credit_sale_id}/whatsapp", response_model=WhatsAppResponse)
async def whatsapp_link(
    credit_sale_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    cs = await db.get(CreditSale, credit_sale_id)
    if not cs or cs.shop_id != shop.id:
        raise HTTPException(status_code=404, detail="Credit sale not found")
    customer = await db.get(CreditCustomer, cs.customer_id)
    name = customer.full_name if customer else "Customer"
    phone = customer.phone if customer else ""
    amount_ghs = cs.amount_pesawas / 100
    msg = (
        f"Hello {name}, this is a reminder that you have an outstanding balance "
        f"of GHS {amount_ghs:.2f} (Ref: {cs.reference}) due on {cs.due_date}. "
        f"Please contact us to arrange payment. Thank you - {shop.name}"
    )
    wa_phone = phone.replace("+", "").replace(" ", "")
    wa_url = f"https://wa.me/{wa_phone}?text={msg.replace(' ', '%20')}"
    return WhatsAppResponse(
        wa_url=wa_url,
        message_text=msg,
        recipient_phone=phone,
        recipient_name=name,
    )


@router.get("/collections", response_model=CollectionsResponse)
async def collection_logs(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=60)

    result = await db.execute(
        select(CreditCollection)
        .join(CreditSale, CreditCollection.credit_sale_id == CreditSale.id)
        .where(
            CreditSale.shop_id == shop.id,
            CreditCollection.created_at >= cutoff,
        )
        .order_by(CreditCollection.created_at.desc())
    )
    collections = result.scalars().all()

    month_total = sum(c.amount_pesawas for c in collections if c.status == "success")
    pending = sum(c.amount_pesawas for c in collections if c.status == "pending")
    active = sum(1 for c in collections if c.status == "pending")

    items = []
    for col in collections:
        cs = await db.get(CreditSale, col.credit_sale_id)
        customer = await db.get(CreditCustomer, cs.customer_id) if cs else None
        items.append(CollectionItem(
            id=col.id,
            credit_sale_id=col.credit_sale_id,
            customer_id=cs.customer_id if cs else "",
            initials=_initials(customer.full_name) if customer else "??",
            name=customer.full_name if customer else "Unknown",
            ref=cs.reference if cs else "",
            network=col.network or "mtn",
            amount_pesawas=col.amount_pesawas,
            status=col.status or "pending",
        ))

    return CollectionsResponse(
        current_month_total_pesawas=month_total,
        pending_vault_pesawas=pending,
        active_requests=active,
        items=items,
    )
