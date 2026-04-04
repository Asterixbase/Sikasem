from pydantic import BaseModel
from typing import Optional


class VaultPayoutRequest(BaseModel):
    amount_pesawas: int
    recipient_phone: str
    network: str  # mtn / telecel


class VaultPayoutResponse(BaseModel):
    payout_id: str
    status: str
    recipient_name: Optional[str]
    amount_pesawas: int
    fee_pesawas: int


class VaultBalanceResponse(BaseModel):
    total_pesawas: int
    available_payout_pesawas: int
    momo_collections_pesawas: int
    today_change_pesawas: int
    recent_activity: list[dict]


class PayoutHistoryResponse(BaseModel):
    total_paid_out_pesawas: int
    trend_pct: float
    period: str
    payouts: list[dict]
