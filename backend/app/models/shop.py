import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    members: Mapped[list["ShopMember"]] = relationship("ShopMember", back_populates="shop")
    products: Mapped[list["Product"]] = relationship("Product", back_populates="shop")
    tax_profile: Mapped["TaxProfile | None"] = relationship("TaxProfile", back_populates="shop", uselist=False)


class TaxProfile(Base):
    __tablename__ = "tax_profiles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), unique=True, nullable=False)
    tin: Mapped[str] = mapped_column(String(20), default="")
    vat_reg_no: Mapped[str] = mapped_column(String(20), default="")
    period_type: Mapped[str] = mapped_column(String(10), default="monthly")

    shop: Mapped["Shop"] = relationship("Shop", back_populates="tax_profile")
