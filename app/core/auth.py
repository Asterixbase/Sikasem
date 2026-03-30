"""
Sikasem Auth — JWT dependency injection and role-based access guards.
Uses Supabase-issued JWTs validated against SUPABASE_JWT_SECRET.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/verify-otp")

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Validate Supabase JWT and return the authenticated User.
    Raises 401 if token is invalid, expired, or user not found/inactive.
    """
    from app.models import User  # local import to avoid circular deps

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase sets aud="authenticated"
        )
        supabase_uid: str = payload.get("sub")
        if not supabase_uid:
            raise _CREDENTIALS_EXCEPTION
    except JWTError:
        raise _CREDENTIALS_EXCEPTION

    user = (
        await db.execute(select(User).where(User.supabase_uid == supabase_uid))
    ).scalar_one_or_none()

    if not user:
        raise _CREDENTIALS_EXCEPTION
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    if not user.phone_verified:
        raise HTTPException(status_code=403, detail="Phone number not verified")

    return user


async def require_circle_member(
    circle_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns (circle, user) if current_user is a member of circle_id."""
    from app.models import Circle, CircleMember

    circle = (
        await db.execute(select(Circle).where(Circle.id == circle_id))
    ).scalar_one_or_none()
    if not circle:
        raise HTTPException(404, "Circle not found")

    membership = (
        await db.execute(
            select(CircleMember).where(
                CircleMember.circle_id == circle_id,
                CircleMember.user_id == current_user.id,
                CircleMember.is_active == True,
            )
        )
    ).scalar_one_or_none()

    is_organiser = circle.organiser_id == current_user.id
    if not membership and not is_organiser:
        raise HTTPException(403, "Not a member of this circle")

    return circle, current_user


async def require_circle_organiser(
    circle_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns (circle, user) if current_user is the organiser of circle_id."""
    from app.models import Circle

    circle = (
        await db.execute(select(Circle).where(Circle.id == circle_id))
    ).scalar_one_or_none()
    if not circle:
        raise HTTPException(404, "Circle not found")

    if circle.organiser_id != current_user.id:
        raise HTTPException(403, "Only the circle organiser can perform this action")

    return circle, current_user
