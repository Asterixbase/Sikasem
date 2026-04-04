"""
Shops router
GET    /v1/shops/{id}
PATCH  /v1/shops/{id}
GET    /v1/shops/{id}/members
POST   /v1/shops/{id}/members
DELETE /v1/shops/{id}/members/{member_id}
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_shop
from app.models.shop import Shop
from app.models.user import ShopMember, User

router = APIRouter()


class ShopUpdateRequest(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    logo: Optional[str] = None


class AddMemberRequest(BaseModel):
    phone: str
    role: str


@router.get("/{shop_id}")
async def get_shop(
    shop_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    if shop.id != shop_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": shop.id,
        "name": shop.name,
        "location": shop.location,
        "logo_url": shop.logo_url,
    }


@router.patch("/{shop_id}")
async def update_shop(
    shop_id: str,
    body: ShopUpdateRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    if shop.id != shop_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if body.name is not None:
        shop.name = body.name
    if body.location is not None:
        shop.location = body.location
    if body.logo is not None:
        shop.logo_url = body.logo
    await db.commit()
    return {"id": shop.id, "name": shop.name, "location": shop.location}


@router.get("/{shop_id}/members")
async def get_members(
    shop_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    if shop.id != shop_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(select(ShopMember).where(ShopMember.shop_id == shop_id))
    members = result.scalars().all()
    out = []
    for m in members:
        user = await db.get(User, m.user_id)
        out.append({
            "member_id": m.id,
            "user_id": m.user_id,
            "phone": user.phone_e164 if user else "",
            "role": m.role,
            "joined": m.created_at.isoformat(),
        })
    return out


@router.post("/{shop_id}/members", status_code=201)
async def add_member(
    shop_id: str,
    body: AddMemberRequest,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    if shop.id != shop_id:
        raise HTTPException(status_code=403, detail="Access denied")
    from app.services.otp import normalize_phone
    phone = normalize_phone(body.phone)
    user_result = await db.execute(select(User).where(User.phone_e164 == phone))
    user = user_result.scalar_one_or_none()
    if not user:
        user = User(id=str(uuid.uuid4()), phone_e164=phone)
        db.add(user)
        await db.flush()
    member = ShopMember(
        id=str(uuid.uuid4()),
        shop_id=shop_id,
        user_id=user.id,
        role=body.role,
    )
    db.add(member)
    await db.commit()
    return {"member_id": member.id, "phone": phone, "role": body.role}


@router.delete("/{shop_id}/members/{member_id}", status_code=204)
async def remove_member(
    shop_id: str,
    member_id: str,
    auth=Depends(get_current_shop),
    db: AsyncSession = Depends(get_db),
):
    _, shop = auth
    if shop.id != shop_id:
        raise HTTPException(status_code=403, detail="Access denied")
    member = await db.get(ShopMember, member_id)
    if not member or member.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="Member not found")
    await db.delete(member)
    await db.commit()
