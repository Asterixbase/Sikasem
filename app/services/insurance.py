"""
Insurance Integration Service
Supports: GLICO Life Ghana, Enterprise Life Ghana.
Coverage types: contribution_protection, life_cover, hardship_relief,
                accidental_death, medical_evacuation.
"""
from datetime import datetime
from typing import Optional
import httpx
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Valid coverage types ──────────────────────────────────────────────
COVERAGE_CATALOG = {
    "contribution_protection": {
        "name": "Contribution Protection",
        "rate_pct": 2.5,
        "min_premium_pesewas": 500,
        "max_cover_pesewas": 120_000,
        "tat_days": {"GLICO": 5, "ENTLIFE": 4},
    },
    "life_cover": {
        "name": "Life Cover",
        "rate_pct": 1.5,
        "min_premium_pesewas": 300,
        "max_cover_pesewas": 240_000,
        "tat_days": {"GLICO": 5, "ENTLIFE": 4},
    },
    "hardship_relief": {
        "name": "Hardship Relief",
        "rate_pct": 3.0,
        "min_premium_pesewas": 600,
        "max_cover_pesewas": 60_000,
        "tat_days": {"GLICO": 5, "ENTLIFE": 4},
    },
    "accidental_death": {
        "name": "Accidental Death",
        "rate_pct": 0.8,
        "min_premium_pesewas": 160,
        "max_cover_pesewas": 500_000,
        "tat_days": {"GLICO": 7, "ENTLIFE": 6},
    },
    "medical_evacuation": {
        "name": "Medical Evacuation",
        "rate_pct": 1.2,
        "min_premium_pesewas": 240,
        "max_cover_pesewas": 300_000,
        "tat_days": {"GLICO": 7, "ENTLIFE": 5},
    },
}

_VALID_COVERAGE_TYPES = set(COVERAGE_CATALOG.keys())


class InsuranceProviderError(Exception):
    """Raised when an insurance provider API returns a non-success response."""
    pass


class InsuranceService:
    """Unified insurance API client for GLICO and Enterprise Life."""

    # ── Validation ────────────────────────────────────────────────────

    @staticmethod
    def validate_coverage_types(coverage_types: list[str]) -> None:
        """Raise ValueError for unknown types or empty list."""
        if not coverage_types:
            raise ValueError("At least one coverage type must be selected")
        unknown = set(coverage_types) - _VALID_COVERAGE_TYPES
        if unknown:
            raise ValueError(f"Unknown coverage type(s): {sorted(unknown)}")

    # ── Premium calculation ───────────────────────────────────────────

    @staticmethod
    def calculate_premium(
        coverage_types: list[str],
        contribution_pesewas: int,
        provider: str = "GLICO",
    ) -> dict:
        """
        Calculate total premium for selected coverage types.
        Premium = max(contribution × rate_pct, min_premium).
        Returns pesewas.
        """
        total_premium = 0
        total_cover   = 0
        breakdown = []

        for ct in coverage_types:
            cat = COVERAGE_CATALOG.get(ct)
            if not cat:
                continue
            rate_premium = round(contribution_pesewas * cat["rate_pct"] / 100)
            premium = max(rate_premium, cat["min_premium_pesewas"])
            cover   = cat["max_cover_pesewas"]
            tat     = cat["tat_days"].get(provider, 5)
            total_premium += premium
            total_cover   += cover
            breakdown.append({
                "type": ct,
                "name": cat["name"],
                "premium_pesewas": premium,
                "max_cover_pesewas": cover,
                "tat_days": tat,
            })

        return {
            "total_premium_pesewas": total_premium,
            "total_cover_pesewas":   total_cover,
            "breakdown": breakdown,
        }

    # ── Policy enrolment ──────────────────────────────────────────────

    async def enrol(
        self,
        provider: str,
        member_phone: str,
        member_name: str,
        member_id: str,
        circle_id: str,
        coverage_types: list[str],
        contribution_pesewas: int,
        beneficiary_name: Optional[str] = None,
        beneficiary_phone: Optional[str] = None,
        beneficiary_relation: Optional[str] = None,
    ) -> dict:
        """Register a new insurance policy with the provider."""
        self.validate_coverage_types(coverage_types)
        calc = self.calculate_premium(coverage_types, contribution_pesewas, provider)

        # Sandbox / dev mode — skip real API call
        _is_dev = settings.ENVIRONMENT == "development"

        if provider == "GLICO":
            if _is_dev or not settings.GLICO_API_KEY:
                return {"policy_ref": f"SANDBOX-GLI-{member_id[:8].upper()}", "status": "ACTIVE"}
            return await self._glico_enrol(
                member_phone, member_name, member_id, circle_id,
                coverage_types, calc, beneficiary_name, beneficiary_phone,
            )
        elif provider == "ENTLIFE":
            if _is_dev or not settings.ENTLIFE_API_KEY:
                return {"policy_ref": f"SANDBOX-ENT-{member_id[:8].upper()}", "status": "ACTIVE"}
            return await self._entlife_enrol(
                member_phone, member_name, member_id, circle_id,
                coverage_types, calc, beneficiary_name, beneficiary_phone,
            )
        else:
            raise ValueError(f"Unknown provider: {provider}")

    async def _glico_enrol(self, phone, name, member_id, circle_id,
                            coverage_types, calc, bene_name, bene_phone):
        payload = {
            "partnerRef": settings.GLICO_PARTNER_ID,
            "memberMsisdn": phone,
            "memberName": name,
            "memberRef": member_id,
            "circleRef": circle_id,
            "coverageTypes": coverage_types,
            "premiumAmount": calc["total_premium_pesewas"],
            "sumAssured": calc["total_cover_pesewas"],
            "beneficiaryName": bene_name,
            "beneficiaryMsisdn": bene_phone,
            "paymentFrequency": "MONTHLY",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{settings.GLICO_API_URL}/policies/enrol",
                json=payload,
                headers={"Authorization": f"Bearer {settings.GLICO_API_KEY}"},
            )
            if r.status_code != 201:
                logger.error("GLICO enrol failed: %s", r.status_code)
                raise InsuranceProviderError(f"GLICO enrolment failed (HTTP {r.status_code})")
            return r.json()

    async def _entlife_enrol(self, phone, name, member_id, circle_id,
                               coverage_types, calc, bene_name, bene_phone):
        payload = {
            "agentCode": settings.ENTLIFE_PARTNER_ID,
            "policyHolder": {"msisdn": phone, "name": name},
            "covers": coverage_types,
            "premiumGhs": calc["total_premium_pesewas"] / 100,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{settings.ENTLIFE_API_URL}/policy/create",
                json=payload,
                headers={"X-API-Key": settings.ENTLIFE_API_KEY},
            )
            if r.status_code != 201:
                logger.error("EntLife enrol failed: %s", r.status_code)
                raise InsuranceProviderError(f"Enterprise Life enrolment failed (HTTP {r.status_code})")
            return r.json()

    # ── Claim submission ──────────────────────────────────────────────

    async def submit_claim(
        self,
        provider: str,
        policy_ref: str,
        claim_ref: str,
        claim_type: str,
        hospital: str,
        incident_date: str,
        amount_pesewas: int,
        description: str,
        document_urls: list[str],
    ) -> dict:
        payload = {
            "policyRef":    policy_ref,
            "claimRef":     claim_ref,
            "claimType":    claim_type,
            "hospital":     hospital,
            "incidentDate": incident_date,
            "amountClaimed": amount_pesewas / 100,
            "description":  description,
            "documents":    document_urls,
        }
        url_map = {
            "GLICO":   (settings.GLICO_API_URL,   {"Authorization": f"Bearer {settings.GLICO_API_KEY}"}),
            "ENTLIFE": (settings.ENTLIFE_API_URL,  {"X-API-Key": settings.ENTLIFE_API_KEY}),
        }
        if provider not in url_map:
            raise ValueError(f"Unknown provider: {provider}")

        base_url, headers = url_map[provider]

        if settings.ENVIRONMENT == "development":
            return {"provider_ref": f"SANDBOX-CLM-{claim_ref}", "status": "SUBMITTED"}

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{base_url}/claims/submit", json=payload, headers=headers)
            if r.status_code not in (200, 201):
                logger.error("%s claim submission failed: %s", provider, r.status_code)
                raise InsuranceProviderError(f"{provider} claim submission failed (HTTP {r.status_code})")
            return r.json()

    # ── Claim status check ────────────────────────────────────────────

    async def get_claim_status(self, provider: str, provider_claim_ref: str) -> dict:
        url_map = {
            "GLICO":   (f"{settings.GLICO_API_URL}/claims/{provider_claim_ref}",
                        {"Authorization": f"Bearer {settings.GLICO_API_KEY}"}),
            "ENTLIFE": (f"{settings.ENTLIFE_API_URL}/claims/{provider_claim_ref}",
                        {"X-API-Key": settings.ENTLIFE_API_KEY}),
        }
        if provider not in url_map:
            return {"status": "UNKNOWN"}
        url, headers = url_map[provider]
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                return {"status": "UNKNOWN"}
            return r.json()


insurance_service = InsuranceService()
