"""
MoMo collect router
POST /v1/momo/collect
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.schemas.sale import MomoCollectRequest, MomoCollectResponse
from app.services.momo import request_to_pay

router = APIRouter()


@router.post("/collect", response_model=MomoCollectResponse)
async def momo_collect(
    body: MomoCollectRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    result = await request_to_pay(
        amount_pesawas=body.amount_pesawas,
        phone_e164=body.phone,
        reference=body.reference,
    )
    return MomoCollectResponse(**result)
