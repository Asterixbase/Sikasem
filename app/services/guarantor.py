"""
Guarantor System Service
Handles: USSD consent via Africa's Talking, auto-trigger cascade,
         HMAC-SHA256 agreement proof, audit trail append.
"""
import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import Optional
import httpx
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

USSD_EXPIRE_HOURS = 36


class GuarantorService:

    # ── USSD consent request ──────────────────────────────────────────

    async def send_consent_ussd(
        self,
        guarantor_phone: str,
        guarantor_name: str,
        member_name: str,
        circle_name: str,
        contribution_ghs: float,
        agreement_ref: str,
    ) -> dict:
        """
        Send USSD push to guarantor for consent.
        Uses Africa's Talking USSD push API (MTN *170# gateway).
        Returns immediately — response comes via USSD callback.
        """
        # Guard against empty name before split
        first_name = (member_name.strip().split() or ["Member"])[0]

        message = (
            f"Sikasem: {member_name} nominated you as guarantor "
            f"for {circle_name} (GHS {contribution_ghs:.2f}/cycle). "
            f"You agree to pay up to GHS {contribution_ghs:.2f} if "
            f"{first_name} misses any contribution.\n"
            f"1. Accept guarantee\n"
            f"2. Decline\n"
            f"Terms: sikasem.gh/g/{agreement_ref}"
        )

        if settings.USSD_PROVIDER == "africastalking":
            return await self._at_ussd_push(guarantor_phone, message)
        elif settings.USSD_PROVIDER == "hubtel":
            return await self._hubtel_ussd_push(guarantor_phone, message)
        else:
            # Dev/sandbox: return mock
            logger.info("[MOCK] USSD sent to %s: %s", guarantor_phone, message[:60])
            return {"status": "SENT", "session_id": str(uuid.uuid4())}

    async def _at_ussd_push(self, phone: str, message: str) -> dict:
        """Africa's Talking USSD push to phone."""
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.africastalking.com/version1/ussd/push",
                data={
                    "username": settings.AFRICASTALKING_USERNAME,
                    "phoneNumber": phone,
                    "message": message,
                    "channel": "USSD",
                },
                headers={
                    "apiKey": settings.AFRICASTALKING_API_KEY,
                    "Accept": "application/json",
                },
            )
            if r.status_code != 200:
                logger.error("AT USSD push failed: status=%s", r.status_code)
                return {"status": "FAILED"}   # do not leak provider response body
            return {"status": "SENT", "response": r.json()}

    async def _hubtel_ussd_push(self, phone: str, message: str) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://devp.hubtel.com/v1/ussd",
                json={"to": phone, "message": message},
                auth=(settings.HUBTEL_CLIENT_ID, settings.HUBTEL_CLIENT_SECRET),
            )
            return {"status": "SENT" if r.status_code < 300 else "FAILED"}

    # ── Agreement proof ───────────────────────────────────────────────

    @staticmethod
    def generate_agreement_ref() -> str:
        return f"AGR-{uuid.uuid4().hex[:8].upper()}"

    @staticmethod
    def generate_hmac_proof(
        agreement_ref: str,
        member_id: str,
        guarantor_phone: str,
        circle_id: str,
        amount: int,
        timestamp: str,
    ) -> str:
        """
        HMAC-SHA256 proof of consent keyed by SECRET_KEY.
        Plain SHA-256 is forgeable — HMAC prevents that.
        Stored immutably; can be verified with verify_proof().
        """
        payload = "|".join([
            agreement_ref, member_id, guarantor_phone,
            circle_id, str(amount), timestamp
        ])
        return hmac.new(
            settings.SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()

    # Keep old name as alias for callers that use generate_sha256_proof
    generate_sha256_proof = generate_hmac_proof

    @staticmethod
    def verify_proof(
        proof: str,
        agreement_ref: str,
        member_id: str,
        guarantor_phone: str,
        circle_id: str,
        amount: int,
        timestamp: str,
    ) -> bool:
        """Constant-time verification of a stored HMAC proof."""
        payload = "|".join([
            agreement_ref, member_id, guarantor_phone,
            circle_id, str(amount), timestamp
        ])
        expected = hmac.new(
            settings.SECRET_KEY.encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, proof)

    # ── Auto-trigger cascade ──────────────────────────────────────────

    async def trigger_guarantor(
        self,
        agreement_ref: str,
        guarantor_phone: str,
        guarantor_name: str,
        member_name: str,
        circle_name: str,
        amount_pesawas: int,
        currency: str,
        audit_log: list,
    ) -> dict:
        """
        Auto-trigger guarantor charge after 3 MoMo retries exhausted.
        1. Append TRIGGERED event to audit log
        2. Send MoMo requestToPay to guarantor
        3. Notify organiser and member via WhatsApp
        """
        from app.services.momo import momo_service

        trigger_ref = str(uuid.uuid4())

        audit_log.append({
            "event": "TRIGGERED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detail": f"3 retries exhausted. Auto-charging guarantor {guarantor_name}",
            "ref": trigger_ref,
        })

        try:
            result = await momo_service.request_to_pay(
                amount_minor=amount_pesawas,
                currency=currency,
                phone=guarantor_phone,
                reference_id=trigger_ref,
                payer_message=f"Sikasem guarantor charge for {member_name} in {circle_name}",
                payee_note=f"Guarantor obligation — {agreement_ref}",
            )
            audit_log.append({
                "event": "CHARGED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "detail": f"MoMo requestToPay sent to guarantor",
                "momo_ref": result.get("x_reference_id"),
            })
            return {"status": "TRIGGERED", "momo_ref": result.get("x_reference_id")}
        except Exception as e:
            logger.error("Guarantor trigger failed: %s", str(e))
            audit_log.append({
                "event": "TRIGGER_FAILED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "detail": "MoMo charge attempt failed",   # don't log raw exception to audit
            })
            raise

    # ── Audit log helpers ─────────────────────────────────────────────

    @staticmethod
    def append_audit(audit_log: list, event: str, detail: str, **extra) -> list:
        """Append an immutable audit event. Returns updated log."""
        entry = {
            "event": event,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detail": detail,
            **extra,
        }
        return [*(audit_log or []), entry]


guarantor_service = GuarantorService()
