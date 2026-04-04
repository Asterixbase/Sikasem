from pydantic import BaseModel
from typing import Optional


class StockMovementCreate(BaseModel):
    product_id: str
    movement_type: str  # purchase / adjustment / sale
    quantity: int
    unit_cost_pesawas: Optional[int] = None
    adjustment_sign: Optional[str] = None  # '+' / '-'
    reason: Optional[str] = None
    notes: Optional[str] = None


class MovementItem(BaseModel):
    type: str
    title: str
    time_ago: str
    change_qty: int
    change_sign: str
    item_name: str
    badge: str
    note: Optional[str]


class MovementsResponse(BaseModel):
    items: list[MovementItem]


class AuditItem(BaseModel):
    product_id: str
    name: str
    sku: str
    expected_qty: int
    actual_qty: Optional[int]
    status: str


class AuditResponse(BaseModel):
    progress: dict
    discrepancies: dict
    items: list[AuditItem]


class AuditConfirmItem(BaseModel):
    product_id: str
    actual_qty: int


class AuditConfirmRequest(BaseModel):
    audit_id: str
    signed_by: str
    items: list[AuditConfirmItem]


class AuditConfirmResponse(BaseModel):
    signed_pdf_url: Optional[str]
    discrepancy_report: dict
