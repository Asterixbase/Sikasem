import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VaultPayout(Base):
    __tablename__ = "vault_payouts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_pesawas: Mapped[int] = mapped_column(Integer, nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    network: Mapped[str] = mapped_column(String(10), nullable=False)  # mtn / telecel
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / success / failed
    fee_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    external_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
