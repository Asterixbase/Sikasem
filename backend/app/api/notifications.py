"""
Notifications API — push token registration.

POST /notifications/register  — store/update Expo push token for current device.
DELETE /notifications/token   — remove push token for current device.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.notification import PushToken

router = APIRouter()


class RegisterTokenRequest(BaseModel):
    token: str  # Expo push token, e.g. "ExponentPushToken[xxxxxx]"


@router.post("/register", status_code=204)
async def register_push_token(
    body: RegisterTokenRequest,
    shop_ctx=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    """Upsert the Expo push token for the calling device."""
    user, shop = shop_ctx
    token = body.token.strip()

    if not token.startswith("ExponentPushToken["):
        return  # ignore invalid/simulator tokens silently

    result = await db.execute(
        select(PushToken).where(
            PushToken.shop_id == shop.id,
            PushToken.token == token,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.user_id = user.id
    else:
        db.add(PushToken(shop_id=shop.id, user_id=user.id, token=token))

    await db.commit()


@router.delete("/token", status_code=204)
async def deregister_push_token(
    body: RegisterTokenRequest,
    shop_ctx=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    """Remove push token (on logout/uninstall)."""
    user, shop = shop_ctx
    await db.execute(
        delete(PushToken).where(
            PushToken.shop_id == shop.id,
            PushToken.token == body.token.strip(),
        )
    )
    await db.commit()
