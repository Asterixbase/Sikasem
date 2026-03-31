"""
Sikasem Database Models — complete schema.
All monetary values stored as INTEGER (minor units / subunits).
GHS → pesewas (÷100), NGN → kobo (÷100), MRU → khoum (÷5), etc.
"""
from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
import uuid

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Integer, String, Text, JSON, UniqueConstraint,
    func, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def new_uuid():
    return str(uuid.uuid4())


# ── Enums ─────────────────────────────────────────────────────────────
class CircleStatus(str, PyEnum):
    FORMING  = "FORMING"
    ACTIVE   = "ACTIVE"
    PAUSED   = "PAUSED"
    COMPLETE = "COMPLETE"
    DISSOLVED= "DISSOLVED"

class PaymentStatus(str, PyEnum):
    PAID    = "PAID"
    PENDING = "PENDING"
    FAILED  = "FAILED"
    NOT_DUE = "NOT_DUE"

class TxnType(str, PyEnum):
    COLLECTION  = "COLLECTION"
    PAYOUT      = "PAYOUT"
    INSURANCE   = "INSURANCE"
    GUARANTOR   = "GUARANTOR"
    FEE         = "FEE"
    REFUND      = "REFUND"

class InsuranceStatus(str, PyEnum):
    NONE         = "NONE"
    ACTIVE       = "ACTIVE"
    CLAIM_ACTIVE = "CLAIM_ACTIVE"
    LAPSED       = "LAPSED"
    CANCELLED    = "CANCELLED"

class ClaimStatus(str, PyEnum):
    SUBMITTED    = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED     = "APPROVED"
    REJECTED     = "REJECTED"
    PAID         = "PAID"

class GuarantorStatus(str, PyEnum):
    NONE      = "NONE"
    PENDING   = "PENDING"
    ACTIVE    = "ACTIVE"
    TRIGGERED = "TRIGGERED"
    RELEASED  = "RELEASED"
    DECLINED  = "DECLINED"

class FrequencyType(str, PyEnum):
    DAILY     = "DAILY"
    WEEKLY    = "WEEKLY"
    BIWEEKLY  = "BIWEEKLY"
    MONTHLY   = "MONTHLY"

class InsuranceProvider(str, PyEnum):
    GLICO   = "GLICO"
    ENTLIFE = "ENTLIFE"


# ── Users ─────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id           = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    supabase_uid = Column(String(64), unique=True, nullable=False, index=True)
    phone        = Column(String(20), unique=True, nullable=False, index=True)
    phone_verified = Column(Boolean, default=False)
    full_name    = Column(String(120), nullable=False)
    initials     = Column(String(4), nullable=False)
    email        = Column(String(255), unique=True, nullable=True)
    avatar_url   = Column(Text, nullable=True)
    ghana_card_id= Column(String(20), unique=True, nullable=True)
    momo_wallet  = Column(String(20), nullable=True)         # verified MoMo number
    momo_verified= Column(Boolean, default=False)
    default_currency = Column(String(3), default="GHS")
    push_token   = Column(Text, nullable=True)                # FCM token
    is_active    = Column(Boolean, default=True)
    kyc_level    = Column(Integer, default=0)                 # 0=none,1=phone,2=ID,3=full
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    # relationships
    organiser_circles = relationship("Circle", back_populates="organiser", foreign_keys="Circle.organiser_id")
    memberships       = relationship("CircleMember", back_populates="user")
    transactions      = relationship("Transaction", back_populates="user")


# ── Circles ───────────────────────────────────────────────────────────
class Circle(Base):
    __tablename__ = "circles"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name            = Column(String(120), nullable=False)
    description     = Column(Text, nullable=True)
    organiser_id    = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    status          = Column(Enum(CircleStatus), default=CircleStatus.FORMING, nullable=False)
    currency        = Column(String(3), default="GHS", nullable=False)
    contribution    = Column(BigInteger, nullable=False)  # in minor units
    frequency       = Column(Enum(FrequencyType), default=FrequencyType.MONTHLY)
    max_members     = Column(Integer, nullable=False)
    current_cycle   = Column(Integer, default=0)
    total_cycles    = Column(Integer, nullable=False)
    next_due_date   = Column(DateTime(timezone=True), nullable=True)
    insurance_enabled  = Column(Boolean, default=False)
    guarantors_required= Column(Boolean, default=False)
    momo_collection_ref= Column(String(80), nullable=True)   # Sikasem MoMo collection ref
    bog_registered  = Column(Boolean, default=False)         # Bank of Ghana registered
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("contribution > 0", name="ck_circle_contribution_positive"),
        CheckConstraint("max_members >= 2", name="ck_circle_min_members"),
    )

    organiser   = relationship("User", back_populates="organiser_circles", foreign_keys=[organiser_id])
    members     = relationship("CircleMember", back_populates="circle", cascade="all, delete-orphan")
    transactions= relationship("Transaction", back_populates="circle")
    payouts     = relationship("CyclePayout", back_populates="circle")


# ── Circle members ─────────────────────────────────────────────────────
class CircleMember(Base):
    __tablename__ = "circle_members"
    __table_args__ = (UniqueConstraint("circle_id", "user_id", name="uq_circle_member"),)

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    circle_id   = Column(UUID(as_uuid=False), ForeignKey("circles.id"), nullable=False)
    user_id     = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    payout_position = Column(Integer, nullable=False)        # 1-based order
    joined_at   = Column(DateTime(timezone=True), server_default=func.now())
    is_active   = Column(Boolean, default=True)

    circle = relationship("Circle", back_populates="members")
    user   = relationship("User", back_populates="memberships")


# ── Cycle payment tracking ─────────────────────────────────────────────
class CyclePayment(Base):
    __tablename__ = "cycle_payments"
    __table_args__ = (UniqueConstraint("circle_id","cycle_number","member_id", name="uq_cycle_payment"),)

    id            = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    circle_id     = Column(UUID(as_uuid=False), ForeignKey("circles.id"), nullable=False)
    member_id     = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    cycle_number  = Column(Integer, nullable=False)
    status        = Column(Enum(PaymentStatus), default=PaymentStatus.NOT_DUE)
    amount        = Column(BigInteger, nullable=False)         # minor units
    due_date      = Column(DateTime(timezone=True), nullable=True)
    paid_at       = Column(DateTime(timezone=True), nullable=True)
    momo_ref      = Column(String(80), nullable=True)
    retry_count   = Column(Integer, default=0)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())


# ── Cycle payouts ──────────────────────────────────────────────────────
class CyclePayout(Base):
    __tablename__ = "cycle_payouts"

    id            = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    circle_id     = Column(UUID(as_uuid=False), ForeignKey("circles.id"), nullable=False)
    recipient_id  = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    cycle_number  = Column(Integer, nullable=False)
    gross_amount  = Column(BigInteger, nullable=False)         # before fee
    momo_fee      = Column(BigInteger, nullable=False)         # 2% MoMo fee
    net_amount    = Column(BigInteger, nullable=False)         # received by member
    momo_ref      = Column(String(80), nullable=True)
    disbursed_at  = Column(DateTime(timezone=True), nullable=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    circle    = relationship("Circle", back_populates="payouts")
    recipient = relationship("User")


# ── Transactions (ledger) ──────────────────────────────────────────────
class Transaction(Base):
    __tablename__ = "transactions"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    circle_id   = Column(UUID(as_uuid=False), ForeignKey("circles.id"), nullable=True)
    user_id     = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    type        = Column(Enum(TxnType), nullable=False)
    amount      = Column(BigInteger, nullable=False)           # minor units
    currency    = Column(String(3), default="GHS")
    cycle_number= Column(Integer, nullable=True)
    momo_ref    = Column(String(80), nullable=True, index=True)
    momo_status = Column(String(40), nullable=True)
    description = Column(Text, nullable=True)
    metadata    = Column(JSON, nullable=True)                  # extra data
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    circle = relationship("Circle", back_populates="transactions")
    user   = relationship("User", back_populates="transactions")


# ── Insurance policies ─────────────────────────────────────────────────
class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    member_id   = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    circle_id   = Column(UUID(as_uuid=False), ForeignKey("circles.id"), nullable=False)
    provider    = Column(Enum(InsuranceProvider), nullable=False)
    policy_ref  = Column(String(80), unique=True, nullable=True)   # provider ref
    coverage_types = Column(JSON, nullable=False)                   # list of type codes
    premium     = Column(BigInteger, nullable=False)                # per cycle, minor units
    max_cover   = Column(BigInteger, nullable=False)
    status      = Column(Enum(InsuranceStatus), default=InsuranceStatus.ACTIVE)
    beneficiary_name  = Column(String(120), nullable=True)
    beneficiary_phone = Column(String(20), nullable=True)
    beneficiary_relation = Column(String(40), nullable=True)
    start_date  = Column(DateTime(timezone=True), nullable=True)
    end_date    = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    member  = relationship("User")
    claims  = relationship("InsuranceClaim", back_populates="policy")


# ── Insurance claims ───────────────────────────────────────────────────
class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    policy_id   = Column(UUID(as_uuid=False), ForeignKey("insurance_policies.id"), nullable=False)
    claim_ref   = Column(String(20), unique=True, nullable=False)  # CLM-XXXXXXXX
    claim_type  = Column(String(40), nullable=False)               # hospitalisation, death, etc.
    description = Column(Text, nullable=True)
    hospital    = Column(String(200), nullable=True)
    incident_date = Column(DateTime(timezone=True), nullable=True)
    amount_claimed= Column(BigInteger, nullable=True)
    amount_approved=Column(BigInteger, nullable=True)
    status      = Column(Enum(ClaimStatus), default=ClaimStatus.SUBMITTED)
    docs_required = Column(Integer, default=4)
    docs_uploaded = Column(Integer, default=0)
    document_urls = Column(JSON, nullable=True)                    # list of S3 URLs
    provider_ref  = Column(String(80), nullable=True)              # provider claim ID
    reviewer_notes= Column(Text, nullable=True)
    filed_at    = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    policy = relationship("InsurancePolicy", back_populates="claims")


# ── Guarantor agreements ───────────────────────────────────────────────
class GuarantorAgreement(Base):
    __tablename__ = "guarantor_agreements"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    member_id       = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    guarantor_phone = Column(String(20), nullable=False)
    guarantor_name  = Column(String(120), nullable=True)
    circle_id       = Column(UUID(as_uuid=False), ForeignKey("circles.id"), nullable=False)
    relation        = Column(String(40), nullable=True)
    status          = Column(Enum(GuarantorStatus), default=GuarantorStatus.PENDING)
    agreement_ref   = Column(String(20), unique=True, nullable=False)   # AGR-XXXXXXXX
    sha256_hash     = Column(String(64), nullable=True)                  # cryptographic proof
    ussd_sent_at    = Column(DateTime(timezone=True), nullable=True)
    expires_at      = Column(DateTime(timezone=True), nullable=True)
    accepted_at     = Column(DateTime(timezone=True), nullable=True)
    triggered_at    = Column(DateTime(timezone=True), nullable=True)
    released_at     = Column(DateTime(timezone=True), nullable=True)
    total_charged   = Column(BigInteger, default=0)                      # total paid as guarantor
    audit_log       = Column(JSON, nullable=True)                        # append-only event log
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    member  = relationship("User", foreign_keys=[member_id])


# ── Currency rates ─────────────────────────────────────────────────────
class CurrencyRate(Base):
    __tablename__ = "currency_rates"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    from_ccy    = Column(String(3), nullable=False)
    to_ccy      = Column(String(3), nullable=False)
    rate        = Column(Float, nullable=False)                           # multiplier
    source      = Column(String(40), default="openexchangerates")
    fetched_at  = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("from_ccy","to_ccy", name="uq_currency_pair"),)
