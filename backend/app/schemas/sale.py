from pydantic import BaseModel
from typing import Optional


class SaleItemIn(BaseModel):
    product_id: str
    quantity: int
    unit_price_pesawas: int


class SaleCreateRequest(BaseModel):
    items: list[SaleItemIn]
    payment_method: str  # cash / momo / credit
    total_pesawas: int


class SaleCreateResponse(BaseModel):
    sale_id: str
    reference: str
    total_pesawas: int
    items_count: int
    stock_updated: bool


class MomoCollectRequest(BaseModel):
    amount_pesawas: int
    phone: str
    reference: str


class MomoCollectResponse(BaseModel):
    status: str
    external_ref: Optional[str]
    message: str


class DailyBatchActivity(BaseModel):
    time: str
    description: str
    method: str
    amount_pesawas: int


class DailyBatchResponse(BaseModel):
    date: str
    total_pesawas: int
    payment_breakdown: dict
    status: str
    activity: list[DailyBatchActivity]


class SearchResult(BaseModel):
    id: str
    type: str
    description: str
    date: str
    amount_pesawas: int
    status: str


class SearchResponse(BaseModel):
    results: list[SearchResult]
    recent_searches: list[str]
    quick_insights: dict
