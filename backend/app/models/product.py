import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("categories.id"), nullable=True)

    children: Mapped[list["Category"]] = relationship("Category", back_populates="parent")
    parent: Mapped["Category | None"] = relationship("Category", back_populates="children", remote_side="Category.id")
    products: Mapped[list["Product"]] = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    sku: Mapped[str] = mapped_column(String(20), nullable=False)
    emoji: Mapped[str] = mapped_column(String(10), default="📦")
    category_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("categories.id"), nullable=True)
    buy_price_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    sell_price_pesawas: Mapped[int] = mapped_column(Integer, default=0)
    current_stock: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    shop: Mapped["Shop"] = relationship("Shop", back_populates="products")
    category: Mapped["Category | None"] = relationship("Category", back_populates="products")
    price_history: Mapped[list["PriceHistory"]] = relationship("PriceHistory", back_populates="product", order_by="PriceHistory.created_at.desc()")
    sale_items: Mapped[list["SaleItem"]] = relationship("SaleItem", back_populates="product")
    stock_movements: Mapped[list["StockMovement"]] = relationship("StockMovement", back_populates="product")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_name: Mapped[str] = mapped_column(String(200), default="Unknown")
    unit_cost_pesawas: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    product: Mapped["Product"] = relationship("Product", back_populates="price_history")
