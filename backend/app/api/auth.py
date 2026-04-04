"""
Auth router — OTP send/verify.
POST /v1/auth/otp/send
POST /v1/auth/otp/verify
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import create_jwt, generate_otp, hash_otp, verify_otp_hash
from app.models.user import User, OtpCode, ShopMember
from app.models.shop import Shop
from app.schemas.auth import OtpSendRequest, OtpSendResponse, OtpVerifyRequest, OtpVerifyResponse
from app.services.otp import normalize_phone, otp_expiry, send_otp
from app.core.config import settings

router = APIRouter()


@router.post("/otp/send", response_model=OtpSendResponse)
async def send_otp_endpoint(body: OtpSendRequest, db: AsyncSession = Depends(get_db)):
    try:
        phone_e164 = normalize_phone(body.phone)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    code = generate_otp()
    code_hash = hash_otp(code)
    expires = otp_expiry()

    otp = OtpCode(
        id=str(uuid.uuid4()),
        phone_e164=phone_e164,
        code_hash=code_hash,
        expires_at=expires,
        used=False,
    )
    db.add(otp)
    await db.commit()

    await send_otp(phone_e164, code)
    return OtpSendResponse(sent=True)


@router.post("/otp/verify", response_model=OtpVerifyResponse)
async def verify_otp_endpoint(body: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    try:
        phone_e164 = normalize_phone(body.phone)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    now = datetime.now(timezone.utc)

    # Bypass: code "000000" works when Twilio is not configured (testing mode)
    dev_bypass = (not settings.twilio_enabled) and body.code == "000000"

    if not dev_bypass:
        # Find the most recent unused, non-expired OTP for this phone
        result = await db.execute(
            select(OtpCode)
            .where(
                OtpCode.phone_e164 == phone_e164,
                OtpCode.used == False,  # noqa: E712
                OtpCode.expires_at > now,
            )
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )
        otp = result.scalar_one_or_none()

        if not otp or not verify_otp_hash(body.code, otp.code_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

        otp.used = True
        await db.flush()

    # Get or create user
    user_result = await db.execute(select(User).where(User.phone_e164 == phone_e164))
    user = user_result.scalar_one_or_none()

    if not user:
        user = User(id=str(uuid.uuid4()), phone_e164=phone_e164)
        db.add(user)
        await db.flush()

    # Get or create shop
    member_result = await db.execute(
        select(ShopMember).where(ShopMember.user_id == user.id)
    )
    member = member_result.scalar_one_or_none()

    if not member:
        shop = Shop(
            id=str(uuid.uuid4()),
            name="My Shop",
            owner_id=user.id,
        )
        db.add(shop)
        await db.flush()

        member = ShopMember(
            id=str(uuid.uuid4()),
            shop_id=shop.id,
            user_id=user.id,
            role="owner",
        )
        db.add(member)
        await db.flush()
        shop_id = shop.id
    else:
        shop_id = member.shop_id

    await db.commit()

    token, expires_at = create_jwt(user.id, shop_id, phone_e164)
    return OtpVerifyResponse(
        jwt=token,
        expires_at=expires_at.isoformat(),
    )
