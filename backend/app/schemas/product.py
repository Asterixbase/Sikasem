from pydantic import BaseModel
from typing import Optional


class SupplierEntry(BaseModel):
    name: str
    date: str
    unit_cost_pesawas: int
    best: bool


class ProductOut(BaseModel):
    product_id: str
    sku: str
    name: str
    emoji: str
    category_breadcrumb: str
    current_stock: int
    urgency: str
    daily_velocity: float
    margin_pct: float
    buy_price_pesawas: int
    sell_price_pesawas: int
    supplier_history: list[SupplierEntry]


class ProductBarcodeOut(BaseModel):
    product_id: str
    name: str
    barcode: Optional[str]
    sell_price_pesawas: int
    buy_price_pesawas: int
    current_stock: int
    category: Optional[dict]


class ProductCreateRequest(BaseModel):
    name: str
    barcode: str
    category_id: str
    sell_price_pesawas: int
    buy_price_pesawas: int
    initial_stock: int


class ProductUpdateRequest(BaseModel):
    sell_price_pesawas: Optional[int] = None
    buy_price_pesawas: Optional[int] = None


class CategoryNode(BaseModel):
    id: str
    name: str
    children: list["CategoryNode"] = []

CategoryNode.model_rebuild()


class CategoryCreateRequest(BaseModel):
    name: str
    parent_id: Optional[str] = None


class CategorySuggestion(BaseModel):
    category_id: str
    name: str
    breadcrumb: str
    confidence: float


class CategorySuggestRequest(BaseModel):
    name: str
    brand: Optional[str] = None
    barcode: Optional[str] = None


class CategorySuggestResponse(BaseModel):
    suggestion: CategorySuggestion
    alternatives: list[dict]
    full_tree: list[CategoryNode]
