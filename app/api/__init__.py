"""
Sikasem API Routers — all endpoints.
All protected routes require authenticated users.
Organiser-only actions use require_circle_organiser.
"""
import hmac as _hmac
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks, Body
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
import logging

from app.core.database import get_db, supabase
from app.core.config import settings
from app.core.auth import get_current_user, require_circle_member, require_circle_organiser
from app.models import (
    User, Circle, CircleMember, CyclePayment, CyclePayout, Transaction,
    InsurancePolicy, InsuranceClaim, GuarantorAgreement, CurrencyRate,
    CircleStatus, PaymentStatus, TxnType, InsuranceStatus, ClaimStatus,
    GuarantorStatus, FrequencyType, InsuranceProvider
)
from app.services.momo import momo_service, MoMoError
from app.services.insurance import insurance_service, COVERAGE_CATALOG, InsuranceProviderError
from app.services.guarantor import guarantor_service

logger = logging.getLogger(__name__)

_GH_PHONE_RE = re.compile(r"^0[2-5]\d{8}$")
_VALID_CLAIM_TYPES = {
    "hospitalisation", "death", "accidental_death",
    "hardship", "contribution_missed", "medical_evacuation",
}
_VALID_CURRENCIES = set(settings.SUPPORTED_CURRENCIES)


def _normalise_gh_phone(phone: str) -> str:
    """Normalise Ghana phone to 0XXXXXXXXX format."""
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+233"):
        phone = "0" + phone[4:]
    elif phone.startswith("233") and len(phone) == 12:
        phone = "0" + phone[3:]
    return phone


def _mask_phone(phone: str, show_full: bool = False) -> str:
    """Return full phone or masked version (0XX****XXX)."""
    if show_full or len(phone) < 6:
        return phone
    return phone[:3] + "****" + phone[-3:]


# ═══════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════
health = APIRouter()


@health.get("/")
async def health_check():
    return {"status": "ok", "version": "2.0.0", "service": "Sikasem API"}


@health.get("/db")
async def db_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(select(1))
        return {"database": "ok"}
    except Exception:
        raise HTTPException(503, detail="Database unavailable")


# ═══════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════
auth = APIRouter()


class RegisterRequest(BaseModel):
    phone: str = Field(..., pattern=r"^0[2-5][0-9]{8}$")
    full_name: str = Field(..., min_length=2, max_length=120)
    password: str = Field(..., min_length=8)
    momo_wallet: Optional[str] = None


class OTPVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r"^0[2-5][0-9]{8}$")
    otp_code: str = Field(..., min_length=4, max_length=6)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    phone: str
    full_name: str


@auth.post("/register", status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new Sikasem user. Sends OTP to phone."""
    existing = await db.execute(select(User).where(User.phone == req.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Phone number already registered")

    try:
        auth_response = supabase.auth.sign_up({
            "phone": f"+233{req.phone[1:]}",
            "password": req.password,
        })
    except Exception:
        raise HTTPException(400, "Registration failed. Please try again.")

    initials = "".join(w[0].upper() for w in req.full_name.split()[:2])
    user = User(
        id=str(uuid.uuid4()),
        supabase_uid=auth_response.user.id if auth_response.user else str(uuid.uuid4()),
        phone=req.phone,
        full_name=req.full_name,
        initials=initials,
        momo_wallet=req.momo_wallet,
    )
    db.add(user)
    await db.commit()

    return {"message": "Registration successful. Check SMS for OTP.", "phone": req.phone}


@auth.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(req: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and return Supabase session tokens."""
    try:
        response = supabase.auth.verify_otp({
            "phone": f"+233{req.phone[1:]}",
            "token": req.otp_code,
            "type": "sms",
        })
        session = response.session
    except Exception:
        raise HTTPException(400, "Invalid or expired OTP")

    user = (await db.execute(select(User).where(User.phone == req.phone))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    user.phone_verified = True
    await db.commit()

    return TokenResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        user_id=user.id,
        phone=user.phone,
        full_name=user.full_name,
    )


# ═══════════════════════════════════════════════════════════════════════
# CIRCLES
# ═══════════════════════════════════════════════════════════════════════
circles = APIRouter()


class CreateCircleRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = None
    currency: str = Field("GHS", max_length=3)
    contribution: int = Field(..., gt=0, description="In minor units (pesewas for GHS)")
    frequency: FrequencyType = FrequencyType.MONTHLY
    max_members: int = Field(..., ge=2, le=100)
    total_cycles: Optional[int] = None
    insurance_enabled: bool = False
    guarantors_required: bool = False


@circles.post("/", status_code=201)
async def create_circle(
    req: CreateCircleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new susu circle. The creator becomes the organiser and first member."""
    if req.currency not in _VALID_CURRENCIES:
        raise HTTPException(400, f"Unsupported currency: {req.currency}")

    total_cycles = req.total_cycles or req.max_members
    circle_id = str(uuid.uuid4())

    circle = Circle(
        id=circle_id,
        name=req.name,
        description=req.description,
        organiser_id=current_user.id,
        currency=req.currency,
        contribution=req.contribution,
        frequency=req.frequency,
        max_members=req.max_members,
        total_cycles=total_cycles,
        insurance_enabled=req.insurance_enabled,
        guarantors_required=req.guarantors_required,
        status=CircleStatus.FORMING,
    )
    db.add(circle)

    # Auto-add organiser as first member
    membership = CircleMember(
        id=str(uuid.uuid4()),
        circle_id=circle_id,
        user_id=current_user.id,
        payout_position=1,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(circle)
    return {"circle_id": circle.id, "status": "FORMING"}


@circles.get("/{circle_id}")
async def get_circle(
    circle_id: str,
    circle_and_user=Depends(require_circle_member),
    db: AsyncSession = Depends(get_db),
):
    """Get full circle details. Phone numbers masked for non-organisers."""
    circle, current_user = circle_and_user
    is_organiser = circle.organiser_id == current_user.id

    members_rows = (await db.execute(
        select(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .where(CircleMember.circle_id == circle_id)
        .order_by(CircleMember.payout_position)
    )).all()

    payments = (await db.execute(
        select(CyclePayment).where(
            and_(CyclePayment.circle_id == circle_id,
                 CyclePayment.cycle_number == circle.current_cycle)
        )
    )).scalars().all()

    payment_map = {p.member_id: p.status for p in payments}

    return {
        "id": circle.id,
        "name": circle.name,
        "status": circle.status,
        "currency": circle.currency,
        "contribution": circle.contribution,
        "frequency": circle.frequency,
        "current_cycle": circle.current_cycle,
        "total_cycles": circle.total_cycles,
        "insurance_enabled": circle.insurance_enabled,
        "guarantors_required": circle.guarantors_required,
        "next_due_date": circle.next_due_date,
        "members": [
            {
                "user_id": u.id,
                "name": u.full_name,
                "phone": _mask_phone(
                    u.phone, show_full=(is_organiser or u.id == current_user.id)
                ),
                "initials": u.initials,
                "payout_position": m.payout_position,
                "payment_status": payment_map.get(u.id, PaymentStatus.NOT_DUE),
            }
            for m, u in members_rows
        ],
    }


# ═══════════════════════════════════════════════════════════════════════
# COLLECTIONS
# ═══════════════════════════════════════════════════════════════════════
collections = APIRouter()


@collections.post("/{circle_id}/collect")
async def collect_dues(
    circle_id: str,
    background_tasks: BackgroundTasks,
    circle_and_user=Depends(require_circle_organiser),
    db: AsyncSession = Depends(get_db),
):
    """Trigger MoMo requestToPay for all members. Organiser only."""
    circle, _ = circle_and_user

    if circle.status != CircleStatus.ACTIVE:
        raise HTTPException(400, "Circle must be ACTIVE to collect dues")

    members_rows = (await db.execute(
        select(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .where(CircleMember.circle_id == circle_id, CircleMember.is_active == True)
    )).all()

    results = []
    for member, user in members_rows:
        ref_id = str(uuid.uuid4())
        payment_id = str(uuid.uuid4())

        cp = CyclePayment(
            id=payment_id,
            circle_id=circle_id,
            member_id=user.id,
            cycle_number=circle.current_cycle,
            status=PaymentStatus.PENDING,
            amount=circle.contribution,
            momo_ref=ref_id,   # persist ref before async fire (idempotency)
        )
        db.add(cp)

        background_tasks.add_task(
            _fire_momo_collection,
            circle=circle,
            user=user,
            payment_id=payment_id,
            ref_id=ref_id,
        )
        results.append({"member": user.full_name, "status": "USSD_SENT"})

    await db.commit()
    return {"message": f"Collection requests sent to {len(results)} members", "results": results}


async def _fire_momo_collection(circle, user, payment_id: str, ref_id: str):
    try:
        await momo_service.request_to_pay(
            amount_minor=circle.contribution,
            currency=circle.currency,
            phone=user.momo_wallet or user.phone,
            reference_id=ref_id,
            payer_message=f"Sikasem {circle.name} Cycle {circle.current_cycle} contribution",
            payee_note=f"Sikasem/{circle.id}/{payment_id}",
        )
    except MoMoError as e:
        logger.error("MoMo collection failed for user %s: %s", user.id, e)


# ═══════════════════════════════════════════════════════════════════════
# PAYOUTS
# ═══════════════════════════════════════════════════════════════════════
payouts = APIRouter()


class PayoutRequest(BaseModel):
    circle_id: str
    schedule_for: Optional[datetime] = None


@payouts.post("/disburse")
async def disburse_payout(
    req: PayoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send payout to current cycle's recipient. Organiser only."""
    from sqlalchemy import text

    # SELECT FOR UPDATE — prevents race condition on concurrent payout calls
    circle = (await db.execute(
        select(Circle).where(Circle.id == req.circle_id).with_for_update()
    )).scalar_one_or_none()
    if not circle:
        raise HTTPException(404)
    if circle.organiser_id != current_user.id:
        raise HTTPException(403, "Only the organiser can disburse payouts")

    # Check for already-disbursed payout this cycle (idempotency)
    existing_payout = (await db.execute(
        select(CyclePayout).where(
            CyclePayout.circle_id == req.circle_id,
            CyclePayout.cycle_number == circle.current_cycle,
            CyclePayout.disbursed_at.isnot(None),
        )
    )).scalar_one_or_none()
    if existing_payout:
        raise HTTPException(409, "Payout already disbursed for this cycle")

    cycle_idx = circle.current_cycle - 1
    members_rows = (await db.execute(
        select(CircleMember, User)
        .join(User, CircleMember.user_id == User.id)
        .where(CircleMember.circle_id == req.circle_id)
        .order_by(CircleMember.payout_position)
    )).all()

    if cycle_idx >= len(members_rows):
        raise HTTPException(400, "All cycles complete")

    recipient_member, recipient_user = members_rows[cycle_idx]

    wallet_check = await momo_service.verify_wallet(
        recipient_user.momo_wallet or recipient_user.phone
    )
    if not wallet_check.get("active"):
        raise HTTPException(400, "MoMo wallet not active for recipient")

    gross     = circle.contribution * len(members_rows)
    fee       = momo_service.calculate_fee(gross)
    net       = gross - fee
    payout_ref = str(uuid.uuid4())

    # Timezone-aware now for comparison
    now_utc = datetime.now(timezone.utc)

    if req.schedule_for:
        # Make schedule_for timezone-aware if naive
        sf = req.schedule_for
        if sf.tzinfo is None:
            sf = sf.replace(tzinfo=timezone.utc)
        if sf > now_utc:
            payout = CyclePayout(
                id=str(uuid.uuid4()),
                circle_id=req.circle_id,
                recipient_id=recipient_user.id,
                cycle_number=circle.current_cycle,
                gross_amount=gross,
                momo_fee=fee,
                net_amount=net,
                scheduled_for=sf,
            )
            db.add(payout)
            await db.commit()
            return {"status": "SCHEDULED", "scheduled_for": sf.isoformat(), "net_amount": net}

    result = await momo_service.transfer(
        amount_minor=net,
        currency=circle.currency,
        phone=recipient_user.momo_wallet or recipient_user.phone,
        reference_id=payout_ref,
        payee_message=f"Sikasem {circle.name} Cycle {circle.current_cycle} payout",
    )

    payout = CyclePayout(
        id=str(uuid.uuid4()),
        circle_id=req.circle_id,
        recipient_id=recipient_user.id,
        cycle_number=circle.current_cycle,
        gross_amount=gross,
        momo_fee=fee,
        net_amount=net,
        momo_ref=result.get("x_reference_id"),
        disbursed_at=now_utc,
    )
    db.add(payout)
    await db.commit()

    return {
        "status": "SENT",
        "recipient": recipient_user.full_name,
        "gross_amount": gross,
        "momo_fee": fee,
        "net_amount": net,
        "momo_ref": result.get("x_reference_id"),
    }


# ═══════════════════════════════════════════════════════════════════════
# INSURANCE
# ═══════════════════════════════════════════════════════════════════════
insurance = APIRouter()


class EnrolRequest(BaseModel):
    circle_id: str
    member_id: str
    provider: InsuranceProvider
    coverage_types: list[str]
    beneficiary_name: Optional[str] = None
    beneficiary_phone: Optional[str] = None
    beneficiary_relation: Optional[str] = None


@insurance.post("/enrol", status_code=201)
async def enrol_insurance(
    req: EnrolRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enrol a circle member in an insurance policy. Organiser or self only."""
    # Validate coverage types before any DB work
    try:
        insurance_service.validate_coverage_types(req.coverage_types)
    except ValueError as e:
        raise HTTPException(400, str(e))

    circle = (await db.execute(select(Circle).where(Circle.id == req.circle_id))).scalar_one_or_none()
    member = (await db.execute(select(User).where(User.id == req.member_id))).scalar_one_or_none()
    if not circle or not member:
        raise HTTPException(404)

    # Only organiser or the member themselves can enrol
    if current_user.id not in (circle.organiser_id, member.id):
        raise HTTPException(403, "Not authorised to enrol this member")

    calc = insurance_service.calculate_premium(
        req.coverage_types, circle.contribution, req.provider.value
    )

    try:
        provider_response = await insurance_service.enrol(
            provider=req.provider.value,
            member_phone=member.momo_wallet or member.phone,
            member_name=member.full_name,
            member_id=member.id,
            circle_id=circle.id,
            coverage_types=req.coverage_types,
            contribution_pesewas=circle.contribution,
            beneficiary_name=req.beneficiary_name,
            beneficiary_phone=req.beneficiary_phone,
            beneficiary_relation=req.beneficiary_relation,
        )
    except InsuranceProviderError as e:
        raise HTTPException(502, "Insurance provider unavailable. Please try again later.")

    policy = InsurancePolicy(
        id=str(uuid.uuid4()),
        member_id=req.member_id,
        circle_id=req.circle_id,
        provider=req.provider,
        policy_ref=provider_response.get("policy_ref"),
        coverage_types=req.coverage_types,
        premium=calc["total_premium_pesewas"],
        max_cover=calc["total_cover_pesewas"],
        status=InsuranceStatus.ACTIVE,
        beneficiary_name=req.beneficiary_name,
        beneficiary_phone=req.beneficiary_phone,
        beneficiary_relation=req.beneficiary_relation,
        start_date=datetime.utcnow(),
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)

    return {
        "policy_id": policy.id,
        "policy_ref": policy.policy_ref,
        "provider": req.provider,
        "premium_per_cycle": policy.premium,
        "max_cover": policy.max_cover,
        "coverage_types": req.coverage_types,
        "status": "ACTIVE",
    }


@insurance.get("/compare")
async def compare_providers(
    coverage_types: str,
    contribution: int,
    current_user: User = Depends(get_current_user),
):
    """Compare GLICO vs Enterprise Life premiums for given coverage types."""
    types = [t.strip() for t in coverage_types.split(",") if t.strip()]
    try:
        insurance_service.validate_coverage_types(types)
    except ValueError as e:
        raise HTTPException(400, str(e))
    glico   = insurance_service.calculate_premium(types, contribution, "GLICO")
    entlife = insurance_service.calculate_premium(types, contribution, "ENTLIFE")
    return {"GLICO": glico, "ENTLIFE": entlife, "coverage_catalog": COVERAGE_CATALOG}


class FileClaimRequest(BaseModel):
    policy_id: str
    claim_type: str
    hospital: Optional[str] = None
    incident_date: str
    amount_claimed: Optional[int] = None
    description: str
    document_urls: list[str] = []


@insurance.post("/claims", status_code=201)
async def file_claim(
    req: FileClaimRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """File an insurance claim. Only the policy member can file."""
    if req.claim_type not in _VALID_CLAIM_TYPES:
        raise HTTPException(400, f"Invalid claim_type. Must be one of: {sorted(_VALID_CLAIM_TYPES)}")

    policy = (await db.execute(
        select(InsurancePolicy).where(InsurancePolicy.id == req.policy_id)
    )).scalar_one_or_none()
    if not policy:
        raise HTTPException(404)

    # Only the policy member can file a claim
    if policy.member_id != current_user.id:
        raise HTTPException(403, "Only the policy member can file a claim")

    claim_ref = f"CLM-{uuid.uuid4().hex[:8].upper()}"

    try:
        provider_resp = await insurance_service.submit_claim(
            provider=policy.provider.value,
            policy_ref=policy.policy_ref or "",
            claim_ref=claim_ref,
            claim_type=req.claim_type,
            hospital=req.hospital or "",
            incident_date=req.incident_date,
            amount_pesewas=req.amount_claimed or 0,
            description=req.description,
            document_urls=req.document_urls,
        )
    except InsuranceProviderError:
        raise HTTPException(502, "Insurance provider unavailable. Please try again later.")

    claim = InsuranceClaim(
        id=str(uuid.uuid4()),
        policy_id=req.policy_id,
        claim_ref=claim_ref,
        claim_type=req.claim_type,
        description=req.description,
        hospital=req.hospital,
        amount_claimed=req.amount_claimed,
        status=ClaimStatus.SUBMITTED,
        docs_required=4,
        docs_uploaded=len(req.document_urls),
        document_urls=req.document_urls,
        provider_ref=provider_resp.get("provider_ref"),
    )
    db.add(claim)
    policy.status = InsuranceStatus.CLAIM_ACTIVE
    await db.commit()

    return {"claim_ref": claim_ref, "status": "SUBMITTED", "provider_ref": provider_resp.get("provider_ref")}


# ═══════════════════════════════════════════════════════════════════════
# GUARANTORS
# ═══════════════════════════════════════════════════════════════════════
guarantors = APIRouter()


class RequestGuarantorRequest(BaseModel):
    member_id: str
    circle_id: str
    guarantor_phone: str
    guarantor_name: Optional[str] = None
    relation: Optional[str] = None


@guarantors.post("/request", status_code=201)
async def request_guarantor(
    req: RequestGuarantorRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a guarantor via USSD *170# push. Auth required."""
    # Validate and normalise phone
    normalised = _normalise_gh_phone(req.guarantor_phone)
    if not _GH_PHONE_RE.match(normalised):
        raise HTTPException(400, "Invalid Ghana phone number for guarantor")

    circle = (await db.execute(select(Circle).where(Circle.id == req.circle_id))).scalar_one_or_none()
    member = (await db.execute(select(User).where(User.id == req.member_id))).scalar_one_or_none()
    if not circle or not member:
        raise HTTPException(404)

    # Only organiser or the member themselves can request a guarantor
    if current_user.id not in (circle.organiser_id, member.id):
        raise HTTPException(403, "Not authorised to request a guarantor for this member")

    agreement_ref = guarantor_service.generate_agreement_ref()
    expires_at    = datetime.utcnow() + __import__('datetime').timedelta(hours=36)
    timestamp_str = datetime.utcnow().isoformat()

    sha256_hash = guarantor_service.generate_hmac_proof(
        agreement_ref, member.id, normalised,
        circle.id, circle.contribution, timestamp_str
    )

    ussd_result = await guarantor_service.send_consent_ussd(
        guarantor_phone=normalised,
        guarantor_name=req.guarantor_name or "Guarantor",
        member_name=member.full_name,
        circle_name=circle.name,
        contribution_ghs=circle.contribution / 100,
        agreement_ref=agreement_ref,
    )

    audit_log = guarantor_service.append_audit(
        [], "REQUEST",
        f"Organiser requested guarantor for member"
    )
    audit_log = guarantor_service.append_audit(
        audit_log, "USSD_SENT",
        f"USSD *170# sent to guarantor phone"
    )

    agreement = GuarantorAgreement(
        id=str(uuid.uuid4()),
        member_id=req.member_id,
        guarantor_phone=normalised,
        guarantor_name=req.guarantor_name,
        circle_id=req.circle_id,
        relation=req.relation,
        status=GuarantorStatus.PENDING,
        agreement_ref=agreement_ref,
        sha256_hash=sha256_hash,
        ussd_sent_at=datetime.utcnow(),
        expires_at=expires_at,
        audit_log=audit_log,
    )
    db.add(agreement)
    await db.commit()

    return {
        "agreement_ref": agreement_ref,
        "sha256_hash": sha256_hash,
        "expires_at": expires_at,
        "ussd_status": ussd_result.get("status"),
    }


@guarantors.post("/{agreement_ref}/accept")
async def accept_guarantor(
    agreement_ref: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a guarantor agreement. Auth required."""
    agreement = (await db.execute(
        select(GuarantorAgreement).where(GuarantorAgreement.agreement_ref == agreement_ref)
    )).scalar_one_or_none()
    if not agreement:
        raise HTTPException(404)

    # Timezone-aware comparison
    now_utc = datetime.now(timezone.utc)
    expires = agreement.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now_utc:
        raise HTTPException(400, "Agreement expired")

    # Only the member or organiser can accept on behalf
    circle = (await db.execute(
        select(Circle).where(Circle.id == agreement.circle_id)
    )).scalar_one_or_none()
    if current_user.id not in (agreement.member_id, circle.organiser_id if circle else None):
        raise HTTPException(403, "Not authorised to accept this agreement")

    agreement.status = GuarantorStatus.ACTIVE
    agreement.accepted_at = datetime.utcnow()
    agreement.audit_log = guarantor_service.append_audit(
        agreement.audit_log or [], "ACCEPTED",
        "Guarantor accepted via API. SHA-256 signed."
    )
    await db.commit()
    return {"status": "ACCEPTED", "agreement_ref": agreement_ref}


@guarantors.get("/{agreement_ref}/audit")
async def get_audit_trail(
    agreement_ref: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full cryptographic audit trail. Member or organiser only."""
    agreement = (await db.execute(
        select(GuarantorAgreement).where(GuarantorAgreement.agreement_ref == agreement_ref)
    )).scalar_one_or_none()
    if not agreement:
        raise HTTPException(404)

    # Verify caller is member or circle organiser
    circle = (await db.execute(
        select(Circle).where(Circle.id == agreement.circle_id)
    )).scalar_one_or_none()
    organiser_id = circle.organiser_id if circle else None
    if current_user.id not in (agreement.member_id, organiser_id):
        raise HTTPException(403, "Access denied")

    return {
        "agreement_ref": agreement.agreement_ref,
        "sha256_hash": agreement.sha256_hash,
        "status": agreement.status,
        "audit_log": agreement.audit_log or [],
    }


# ═══════════════════════════════════════════════════════════════════════
# CURRENCIES
# ═══════════════════════════════════════════════════════════════════════
currencies = APIRouter()

CURRENCY_METADATA = {
    "GHS": {"name": "Ghana Cedi",          "country": "Ghana",        "flag": "🇬🇭", "subunit": "pesewa",  "factor": 100, "provider": "MTN MoMo / Telecel Cash", "ussd": "*170#"},
    "NGN": {"name": "Nigerian Naira",       "country": "Nigeria",      "flag": "🇳🇬", "subunit": "kobo",    "factor": 100, "provider": "OPay / Palmpay",          "ussd": "*737#"},
    "XOF": {"name": "CFA Franc",            "country": "Senegal/CI",   "flag": "🇸🇳", "subunit": "centime", "factor": 100, "provider": "Orange Money / Wave",     "ussd": "*144#"},
    "SLL": {"name": "Sierra Leone Leone",   "country": "Sierra Leone", "flag": "🇸🇱", "subunit": "cent",    "factor": 100, "provider": "Orange Money / Africell", "ussd": "*144#"},
    "GMD": {"name": "Gambian Dalasi",       "country": "Gambia",       "flag": "🇬🇲", "subunit": "butut",   "factor": 100, "provider": "QMoney / Reliance",       "ussd": "*880#"},
    "GNF": {"name": "Guinean Franc",        "country": "Guinea",       "flag": "🇬🇳", "subunit": "centime", "factor": 100, "provider": "Orange / MTN Guinea",     "ussd": "*155#"},
    "LRD": {"name": "Liberian Dollar",      "country": "Liberia",      "flag": "🇱🇷", "subunit": "cent",    "factor": 100, "provider": "Lonestar / Orange",       "ussd": "*156#"},
    "CVE": {"name": "Cape Verde Escudo",    "country": "Cape Verde",   "flag": "🇨🇻", "subunit": "centavo", "factor": 100, "provider": "VINTI4",                  "ussd": "N/A"},
    "MRU": {"name": "Mauritanian Ouguiya",  "country": "Mauritania",   "flag": "🇲🇷", "subunit": "khoum",   "factor": 5,   "provider": "Moov / Mauritel",         "ussd": "*555#"},
    "GBP": {"name": "British Pound",        "country": "UK Diaspora",  "flag": "🇬🇧", "subunit": "penny",   "factor": 100, "provider": "Bank Transfer / Wise",    "ussd": "N/A"},
}


@currencies.get("/")
async def list_currencies(current_user: User = Depends(get_current_user)):
    return {"currencies": CURRENCY_METADATA, "default": "GHS"}


@currencies.get("/rates")
async def get_rates(
    base: str = "GHS",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if base not in _VALID_CURRENCIES:
        raise HTTPException(400, f"Unsupported currency: {base}")
    rates = (await db.execute(
        select(CurrencyRate).where(CurrencyRate.from_ccy == base)
    )).scalars().all()
    return {"base": base, "rates": {r.to_ccy: r.rate for r in rates}}


# ═══════════════════════════════════════════════════════════════════════
# MEMBERS
# ═══════════════════════════════════════════════════════════════════════
members = APIRouter()


class AddMemberRequest(BaseModel):
    circle_id: str
    phone: str = Field(..., pattern=r"^0[2-5][0-9]{8}$")
    payout_position: int = Field(..., ge=1)


@members.post("/add", status_code=201)
async def add_member(
    req: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a member to a circle. Organiser only."""
    circle = (await db.execute(select(Circle).where(Circle.id == req.circle_id))).scalar_one_or_none()
    if not circle:
        raise HTTPException(404, "Circle not found")
    if circle.organiser_id != current_user.id:
        raise HTTPException(403, "Only the organiser can add members")

    user = (await db.execute(select(User).where(User.phone == req.phone))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User with this phone not found. Ask them to register first.")

    membership = CircleMember(
        id=str(uuid.uuid4()),
        circle_id=req.circle_id,
        user_id=user.id,
        payout_position=req.payout_position,
    )
    db.add(membership)
    await db.commit()
    return {"member_id": user.id, "name": user.full_name, "payout_position": req.payout_position}


# ═══════════════════════════════════════════════════════════════════════
# WEBHOOKS
# ═══════════════════════════════════════════════════════════════════════
webhooks = APIRouter()


@webhooks.post("/momo/collection")
async def momo_collection_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    MTN MoMo webhook for collection status updates.
    Validates HMAC-SHA256 signature in production.
    """
    raw_body = await request.body()

    # Validate signature in production
    if settings.ENVIRONMENT == "production":
        sig = request.headers.get("X-Signature") or request.headers.get("Authorization", "")
        ts  = request.headers.get("X-Timestamp")
        if not momo_service.validate_webhook_signature(raw_body, sig, timestamp=ts):
            raise HTTPException(401, "Invalid webhook signature")

    try:
        import json as _json
        payload = _json.loads(raw_body)
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")

    ref_id   = payload.get("externalId") or payload.get("referenceId")
    status_  = payload.get("status")
    momo_ref = payload.get("financialTransactionId")

    if not ref_id:
        return {"received": True}

    await db.execute(
        update(CyclePayment)
        .where(CyclePayment.momo_ref == ref_id)
        .values(
            status=PaymentStatus.PAID if status_ == "SUCCESSFUL" else PaymentStatus.FAILED,
            momo_ref=momo_ref,
            paid_at=datetime.utcnow() if status_ == "SUCCESSFUL" else None,
        )
    )

    if status_ == "FAILED":
        payment = (await db.execute(
            select(CyclePayment).where(CyclePayment.momo_ref == ref_id)
        )).scalar_one_or_none()

        if payment:
            payment.retry_count = (payment.retry_count or 0) + 1
            if payment.retry_count >= 3:
                agreement = (await db.execute(
                    select(GuarantorAgreement).where(
                        and_(
                            GuarantorAgreement.member_id == payment.member_id,
                            GuarantorAgreement.circle_id == payment.circle_id,
                            GuarantorAgreement.status == GuarantorStatus.ACTIVE,
                        )
                    )
                )).scalar_one_or_none()

                if agreement:
                    circle = (await db.execute(
                        select(Circle).where(Circle.id == payment.circle_id)
                    )).scalar_one_or_none()
                    try:
                        await guarantor_service.trigger_guarantor(
                            agreement_ref=agreement.agreement_ref,
                            guarantor_phone=agreement.guarantor_phone,
                            guarantor_name=agreement.guarantor_name or "Guarantor",
                            member_name="Member",
                            circle_name=circle.name if circle else "Circle",
                            amount_pesawas=payment.amount,
                            currency=circle.currency if circle else "GHS",
                            audit_log=agreement.audit_log or [],
                        )
                        agreement.status = GuarantorStatus.TRIGGERED
                        agreement.triggered_at = datetime.utcnow()
                    except Exception as e:
                        logger.error("Guarantor trigger failed: %s", e)

    await db.commit()
    logger.info("MoMo collection webhook: ref=%s status=%s", ref_id, status_)
    return {"received": True}


@webhooks.post("/momo/disbursement")
async def momo_disbursement_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """MTN MoMo webhook for disbursement (payout) status."""
    raw_body = await request.body()

    if settings.ENVIRONMENT == "production":
        sig = request.headers.get("X-Signature") or request.headers.get("Authorization", "")
        ts  = request.headers.get("X-Timestamp")
        if not momo_service.validate_webhook_signature(raw_body, sig, timestamp=ts):
            raise HTTPException(401, "Invalid webhook signature")

    try:
        import json as _json
        payload = _json.loads(raw_body)
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")

    ref_id   = payload.get("externalId")
    status_  = payload.get("status")
    momo_ref = payload.get("financialTransactionId")

    if ref_id and status_ == "SUCCESSFUL":
        await db.execute(
            update(CyclePayout)
            .where(CyclePayout.momo_ref == ref_id)
            .values(momo_ref=momo_ref, disbursed_at=datetime.utcnow())
        )
        await db.commit()

    return {"received": True}


@webhooks.post("/ussd/consent")
async def ussd_consent_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Africa's Talking USSD callback for guarantor consent.
    Validates HMAC signature in production. Exact phone match (no LIKE injection).
    """
    # Validate Africa's Talking signature in production
    if settings.ENVIRONMENT == "production" and settings.AFRICASTALKING_WEBHOOK_SECRET:
        raw_body = await request.body()
        expected_sig = _hmac.new(
            settings.AFRICASTALKING_WEBHOOK_SECRET.encode(),
            raw_body,
            __import__('hashlib').sha256,
        ).hexdigest()
        incoming_sig = request.headers.get("X-AT-Signature", "")
        if not _hmac.compare_digest(expected_sig, incoming_sig):
            raise HTTPException(401, "Invalid webhook signature")

    form = await request.form()
    phone_number = form.get("phoneNumber", "")
    text         = form.get("text", "")

    choice = text.strip()

    # Normalise to 0XXXXXXXXX and do exact match (prevents LIKE injection)
    normalised_phone = _normalise_gh_phone(phone_number)

    agreement = (await db.execute(
        select(GuarantorAgreement).where(
            and_(
                GuarantorAgreement.guarantor_phone == normalised_phone,  # exact match
                GuarantorAgreement.status == GuarantorStatus.PENDING,
                GuarantorAgreement.expires_at > datetime.utcnow(),
            )
        )
    )).scalar_one_or_none()

    if not agreement:
        return "END No pending guarantor request found."

    if choice == "1":
        agreement.status = GuarantorStatus.ACTIVE
        agreement.accepted_at = datetime.utcnow()
        agreement.audit_log = guarantor_service.append_audit(
            agreement.audit_log or [], "ACCEPTED", "Guarantor accepted via USSD *170#"
        )
        await db.commit()
        return "END You have accepted the guarantor request. Thank you."
    elif choice == "2":
        agreement.status = GuarantorStatus.DECLINED
        agreement.audit_log = guarantor_service.append_audit(
            agreement.audit_log or [], "DECLINED", "Guarantor declined via USSD *170#"
        )
        await db.commit()
        return "END You have declined the guarantor request."
    else:
        return "CON Sikasem Guarantor Consent\n1. Accept guarantee\n2. Decline"
