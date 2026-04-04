import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TaxInvoice(Base):
    __tablename__ = "tax_invoices"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    period: Mapped[str] = mapped_column(String(7), nullable=False, index=True)  # YYYY-MM
    invoice_type: Mapped[str] = mapped_column(String(10), nullable=False)  # input / output
    vendor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    vendor_tin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    taxable_amount_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    vat_amount_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    nhil_amount_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    getfund_amount_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
