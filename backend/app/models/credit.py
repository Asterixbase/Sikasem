import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CreditCustomer(Base):
    __tablename__ = "credit_customers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    id_type: Mapped[str] = mapped_column(String(30), default="ghana_card")
    id_number: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    momo_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    credit_sales: Mapped[list["CreditSale"]] = relationship("CreditSale", back_populates="customer")


class CreditSale(Base):
    __tablename__ = "credit_sales"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("credit_customers.id"), nullable=False)
    reference: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    amount_pesawas: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / paid / overdue / written_off
    momo_queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    customer: Mapped["CreditCustomer"] = relationship("CreditCustomer", back_populates="credit_sales")
    items: Mapped[list["CreditSaleItem"]] = relationship("CreditSaleItem", back_populates="credit_sale", cascade="all, delete-orphan")
    collections: Mapped[list["CreditCollection"]] = relationship("CreditCollection", back_populates="credit_sale")


class CreditSaleItem(Base):
    __tablename__ = "credit_sale_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    credit_sale_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("credit_sales.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("products.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_pesawas: Mapped[int] = mapped_column(Integer, nullable=False)

    credit_sale: Mapped["CreditSale"] = relationship("CreditSale", back_populates="items")


class CreditCollection(Base):
    __tablename__ = "credit_collections"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    credit_sale_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("credit_sales.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_pesawas: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / success / failed
    network: Mapped[str] = mapped_column(String(10), default="mtn")
    external_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    credit_sale: Mapped["CreditSale"] = relationship("CreditSale", back_populates="collections")
