"""
Tax router
GET  /v1/tax/dashboard
GET  /v1/tax/profile
POST /v1/tax/invoices/ocr-extract
POST /v1/tax/invoices
GET  /v1/tax/invoices
GET  /v1/tax/periods/{year}/{month}/export/csv
"""
import csv
import io
import uuid
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.shop import TaxProfile
from app.models.tax import TaxInvoice
from app.schemas.tax import TaxInvoiceCreate, OcrExtractInvoiceRequest
from app.services.ocr import extract_invoice

router = APIRouter()


async def _get_or_create_tax_profile(db: AsyncSession, shop_id: str) -> TaxProfile:
    result = await db.execute(select(TaxProfile).where(TaxProfile.shop_id == shop_id))
    profile = result.scalar_one_or_none()
    if not profile:
        profile = TaxProfile(id=str(uuid.uuid4()), shop_id=shop_id)
        db.add(profile)
        await db.flush()
    return profile


@router.get("/dashboard")
async def tax_dashboard(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    today = date.today()
    current_period = today.strftime("%Y-%m")
    # Filing deadline: 15th of next month
    if today.month == 12:
        deadline = date(today.year + 1, 1, 15)
    else:
        deadline = date(today.year, today.month + 1, 15)
    days_left = (deadline - today).days

    # Output VAT (from sales invoices)
    out_result = await db.execute(
        select(func.sum(TaxInvoice.vat_amount_pesawas)).where(
            TaxInvoice.shop_id == shop.id,
            TaxInvoice.period == current_period,
            TaxInvoice.invoice_type == "output",
        )
    )
    output_vat = out_result.scalar() or 0

    # Input VAT (from purchase invoices)
    in_result = await db.execute(
        select(func.sum(TaxInvoice.vat_amount_pesawas)).where(
            TaxInvoice.shop_id == shop.id,
            TaxInvoice.period == current_period,
            TaxInvoice.invoice_type == "input",
        )
    )
    input_vat = in_result.scalar() or 0
    vat_payable = max(output_vat - input_vat, 0)

    # Recent invoices
    recent_result = await db.execute(
        select(TaxInvoice)
        .where(TaxInvoice.shop_id == shop.id)
        .order_by(TaxInvoice.created_at.desc())
        .limit(5)
    )
    recent = recent_result.scalars().all()

    # 6-month trend (months)
    trend = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        period_str = f"{y}-{m:02d}"
        pr = await db.execute(
            select(func.sum(TaxInvoice.vat_amount_pesawas)).where(
                TaxInvoice.shop_id == shop.id,
                TaxInvoice.period == period_str,
            )
        )
        trend.append({"period": period_str, "vat_pesawas": pr.scalar() or 0})

    return {
        "current_period": current_period,
        "vat_payable_pesawas": vat_payable,
        "output_vat_pesawas": output_vat,
        "input_vat_pesawas": input_vat,
        "filing_deadline": deadline.isoformat(),
        "days_until_deadline": days_left,
        "trend": trend,
        "recent_invoices": [
            {
                "id": inv.id,
                "period": inv.period,
                "invoice_type": inv.invoice_type,
                "vendor_name": inv.vendor_name,
                "vendor_tin": inv.vendor_tin,
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date.isoformat(),
                "total_amount_pesawas": inv.total_amount_pesawas,
                "vat_amount_pesawas": inv.vat_amount_pesawas,
                "created_at": inv.created_at.isoformat(),
            }
            for inv in recent
        ],
    }


@router.get("/profile")
async def tax_profile(
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    profile = await _get_or_create_tax_profile(db, shop.id)
    await db.commit()
    return {
        "tin": profile.tin,
        "vat_reg_no": profile.vat_reg_no,
        "period_type": profile.period_type,
        "shop_id": shop.id,
    }


@router.post("/invoices/ocr-extract")
async def ocr_extract(
    body: OcrExtractInvoiceRequest,
    auth=Depends(get_current_shop),
):
    return await extract_invoice(body.image_base64, body.period)


@router.post("/invoices", status_code=201)
async def save_invoice(
    body: TaxInvoiceCreate,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    inv = TaxInvoice(
        id=str(uuid.uuid4()),
        shop_id=shop.id,
        period=body.period,
        invoice_type=body.invoice_type,
        vendor_name=body.vendor_name,
        vendor_tin=body.vendor_tin,
        invoice_number=body.invoice_number,
        invoice_date=date.fromisoformat(body.invoice_date),
        total_amount_pesawas=body.total_amount_pesawas,
        taxable_amount_pesawas=body.taxable_amount_pesawas,
        vat_amount_pesawas=body.vat_amount_pesawas,
        nhil_amount_pesawas=body.nhil_amount_pesawas,
        getfund_amount_pesawas=body.getfund_amount_pesawas,
    )
    db.add(inv)
    await db.commit()
    return {"id": inv.id, "period": inv.period, "invoice_type": inv.invoice_type}


@router.get("/invoices")
async def list_invoices(
    period: str = Query(...),
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    result = await db.execute(
        select(TaxInvoice)
        .where(TaxInvoice.shop_id == shop.id, TaxInvoice.period == period)
        .order_by(TaxInvoice.created_at.desc())
    )
    invoices = result.scalars().all()
    return [
        {
            "id": inv.id,
            "period": inv.period,
            "invoice_type": inv.invoice_type,
            "vendor_name": inv.vendor_name,
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date.isoformat(),
            "total_amount_pesawas": inv.total_amount_pesawas,
            "vat_amount_pesawas": inv.vat_amount_pesawas,
            "created_at": inv.created_at.isoformat(),
        }
        for inv in invoices
    ]


@router.get("/periods/{year}/{month}/export/csv")
async def export_gra_csv(
    year: int,
    month: int,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    period = f"{year}-{month:02d}"
    result = await db.execute(
        select(TaxInvoice).where(TaxInvoice.shop_id == shop.id, TaxInvoice.period == period)
    )
    invoices = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)

    # PART A — Output (Sales)
    writer.writerow(["PART A — OUTPUT TAX (SALES)"])
    writer.writerow(["#", "Invoice No", "Date", "Customer/Vendor", "TIN", "Total (GHS)", "Taxable (GHS)", "VAT (GHS)"])
    output_invoices = [i for i in invoices if i.invoice_type == "output"]
    for idx, inv in enumerate(output_invoices, 1):
        writer.writerow([
            idx, inv.invoice_number, inv.invoice_date.isoformat(), inv.vendor_name,
            inv.vendor_tin or "", inv.total_amount_pesawas / 100,
            inv.taxable_amount_pesawas / 100, inv.vat_amount_pesawas / 100,
        ])

    writer.writerow([])

    # PART B — Input (Purchases)
    writer.writerow(["PART B — INPUT TAX (PURCHASES)"])
    writer.writerow(["#", "Invoice No", "Date", "Supplier", "TIN", "Total (GHS)", "Taxable (GHS)", "VAT (GHS)"])
    input_invoices = [i for i in invoices if i.invoice_type == "input"]
    for idx, inv in enumerate(input_invoices, 1):
        writer.writerow([
            idx, inv.invoice_number, inv.invoice_date.isoformat(), inv.vendor_name,
            inv.vendor_tin or "", inv.total_amount_pesawas / 100,
            inv.taxable_amount_pesawas / 100, inv.vat_amount_pesawas / 100,
        ])

    writer.writerow([])

    # SUMMARY
    total_output = sum(i.vat_amount_pesawas for i in output_invoices)
    total_input = sum(i.vat_amount_pesawas for i in input_invoices)
    writer.writerow(["SUMMARY"])
    writer.writerow(["Output VAT (GHS)", total_output / 100])
    writer.writerow(["Input VAT (GHS)", total_input / 100])
    writer.writerow(["Net VAT Payable (GHS)", max(total_output - total_input, 0) / 100])

    output.seek(0)
    filename = f"sikasem_gra_{period}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
