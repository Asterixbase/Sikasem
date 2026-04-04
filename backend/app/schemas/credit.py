from pydantic import BaseModel
from typing import Optional


class CreditCustomerCreate(BaseModel):
    full_name: str
    id_type: str
    id_number: str
    phone: str
    momo_phone: Optional[str] = None


class CreditCustomerOut(BaseModel):
    customer_id: str
    full_name: str
    phone_e164: str
    created: str


class CreditSaleItemIn(BaseModel):
    product_id: str
    quantity: int
    unit_price_pesawas: int


class CreditSaleCreate(BaseModel):
    customer_id: str
    amount_pesawas: int
    due_date: str
    momo_auto_request: bool
    items: list[CreditSaleItemIn]


class CreditSaleOut(BaseModel):
    credit_sale_id: str
    reference: str
    amount_pesawas: int
    due_date: str
    status: str
    customer_name: str
    customer_phone: str
    momo_queued_at: Optional[str]


class CreditStatusUpdate(BaseModel):
    status: str  # paid / written_off / overdue


class WhatsAppResponse(BaseModel):
    wa_url: str
    message_text: str
    recipient_phone: str
    recipient_name: str


class CollectionItem(BaseModel):
    id: str              # credit_collection.id — used for retry
    credit_sale_id: str  # credit_sale.id — used for momo-request endpoint
    customer_id: str
    initials: str
    name: str
    ref: str
    network: Optional[str]
    amount_pesawas: int
    status: str          # "success" | "pending" | "failed" (lowercase)


class CollectionsResponse(BaseModel):
    current_month_total_pesawas: int
    pending_vault_pesawas: int
    active_requests: int
    items: list[CollectionItem]
