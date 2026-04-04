import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)  # purchase / adjustment / sale
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost_pesawas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    adjustment_sign: Mapped[str | None] = mapped_column(String(1), nullable=True)  # '+' or '-'
    reason: Mapped[str | None] = mapped_column(String(50), nullable=True)  # damage / loss / correction / expired
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    product: Mapped["Product"] = relationship("Product", back_populates="stock_movements")
