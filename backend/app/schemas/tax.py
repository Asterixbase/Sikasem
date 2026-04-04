from pydantic import BaseModel
from typing import Optional


class TaxInvoiceCreate(BaseModel):
    period: str
    invoice_type: str
    vendor_name: str
    vendor_tin: Optional[str] = None
    invoice_number: str
    invoice_date: str
    total_amount_pesawas: int
    taxable_amount_pesawas: int
    vat_amount_pesawas: int
    nhil_amount_pesawas: int = 0
    getfund_amount_pesawas: int = 0


class TaxInvoiceOut(BaseModel):
    id: str
    period: str
    invoice_type: str
    vendor_name: str
    vendor_tin: Optional[str]
    invoice_number: str
    invoice_date: str
    total_amount_pesawas: int
    vat_amount_pesawas: int
    created_at: str


class OcrExtractInvoiceRequest(BaseModel):
    image_base64: str
    period: str


class TaxDashboardResponse(BaseModel):
    current_period: str
    vat_payable_pesawas: int
    output_vat_pesawas: int
    input_vat_pesawas: int
    filing_deadline: str
    days_until_deadline: int
    trend: list[dict]
    recent_invoices: list[TaxInvoiceOut]


class TaxProfileOut(BaseModel):
    tin: str
    vat_reg_no: str
    period_type: str
    shop_id: str
