"""
MTN Mobile Money Integration Service
Handles: requestToPay (collections), transfer (disbursements), webhook validation.
Supports sandbox and production environments.
"""
import asyncio
import base64
import hashlib
import hmac
import time
import uuid
from datetime import datetime
from typing import Optional
import httpx
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

MOMO_BASE = {
    "sandbox":    "https://sandbox.momodeveloper.mtn.com",
    "production": "https://proxy.momoapi.mtn.com",
}

_RETRY_DELAYS = [1, 2, 4]   # seconds — exponential backoff for 5xx


class MoMoService:
    """MTN MoMo API client for Collections and Disbursements."""

    def __init__(self):
        self.env = settings.MOMO_ENVIRONMENT
        self.base_url = MOMO_BASE[self.env]
        self._col_token: Optional[str] = None
        self._dis_token: Optional[str] = None
        self._col_token_exp: float = 0.0   # Unix timestamp of expiry
        self._dis_token_exp: float = 0.0

    # ── Token management ──────────────────────────────────────────────

    async def _get_collection_token(self) -> str:
        """Fetch (or return cached) OAuth2 bearer token for Collections API."""
        if self._col_token and time.time() < self._col_token_exp - 60:
            return self._col_token

        credentials = base64.b64encode(
            f"{settings.MOMO_COLLECTION_USER_ID}:{settings.MOMO_COLLECTION_API_KEY}".encode()
        ).decode()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/collection/token/",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Ocp-Apim-Subscription-Key": settings.MOMO_COLLECTION_PRIMARY_KEY,
                },
            )
            r.raise_for_status()
            data = r.json()
            self._col_token = data["access_token"]
            self._col_token_exp = time.time() + data.get("expires_in", 3600)
            return self._col_token

    async def _get_disbursement_token(self) -> str:
        """Fetch (or return cached) OAuth2 bearer token for Disbursements API."""
        if self._dis_token and time.time() < self._dis_token_exp - 60:
            return self._dis_token

        credentials = base64.b64encode(
            f"{settings.MOMO_DISBURSEMENT_USER_ID}:{settings.MOMO_DISBURSEMENT_API_KEY}".encode()
        ).decode()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/disbursement/token/",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Ocp-Apim-Subscription-Key": settings.MOMO_DISBURSEMENT_PRIMARY_KEY,
                },
            )
            r.raise_for_status()
            data = r.json()
            self._dis_token = data["access_token"]
            self._dis_token_exp = time.time() + data.get("expires_in", 3600)
            return self._dis_token

    # ── Retry helper ──────────────────────────────────────────────────

    async def _post_with_retry(self, client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
        """POST with exponential backoff on 5xx; no retry on 4xx."""
        last_exc = None
        for attempt, delay in enumerate([0] + _RETRY_DELAYS):
            if delay:
                await asyncio.sleep(delay)
            try:
                r = await client.post(url, **kwargs)
                if r.status_code < 500:
                    return r
                logger.warning("MoMo 5xx on attempt %d: %s", attempt + 1, r.status_code)
                last_exc = MoMoError(f"HTTP {r.status_code}")
            except httpx.TransportError as e:
                logger.warning("MoMo transport error on attempt %d: %s", attempt + 1, e)
                last_exc = MoMoError(str(e))
        raise last_exc

    # ── Collections (requestToPay) ────────────────────────────────────

    async def request_to_pay(
        self,
        amount_minor: int,           # in pesewas
        currency: str,               # GHS
        phone: str,                  # 0244XXXXXX → strip leading 0, add 233
        reference_id: str,           # internal UUID
        payer_message: str,
        payee_note: str,
    ) -> dict:
        """
        Initiate a requestToPay to a member's MoMo wallet.
        Returns immediately; result arrives via webhook.
        """
        token = await self._get_collection_token()
        x_ref = str(uuid.uuid4())
        amount_major = amount_minor / 100  # pesewas → GHS
        msisdn = self._normalise_phone(phone, "233")

        payload = {
            "amount": str(amount_major),
            "currency": currency,
            "externalId": reference_id,
            "payer": {"partyIdType": "MSISDN", "partyId": msisdn},
            "payerMessage": payer_message[:160],
            "payeeNote": payee_note[:160],
        }

        async with httpx.AsyncClient() as client:
            r = await self._post_with_retry(
                client,
                f"{self.base_url}/collection/v1_0/requesttopay",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Reference-Id": x_ref,
                    "X-Target-Environment": self.env,
                    "Ocp-Apim-Subscription-Key": settings.MOMO_COLLECTION_PRIMARY_KEY,
                    "X-Callback-Url": f"{settings.MOMO_CALLBACK_HOST}/webhooks/momo/collection",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code not in (202, 200):
                logger.error("MoMo requestToPay failed: %s", r.status_code)
                raise MoMoError(f"requestToPay failed: {r.status_code}")

        logger.info("MoMo requestToPay sent: ref=%s phone=%s amount=%s", x_ref, msisdn, amount_major)
        return {"x_reference_id": x_ref, "status": "PENDING"}

    async def get_collection_status(self, x_reference_id: str) -> dict:
        """Poll collection status (use webhooks in production instead)."""
        token = await self._get_collection_token()
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/collection/v1_0/requesttopay/{x_reference_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Target-Environment": self.env,
                    "Ocp-Apim-Subscription-Key": settings.MOMO_COLLECTION_PRIMARY_KEY,
                },
            )
            r.raise_for_status()
            return r.json()

    # ── Disbursements (transfer) ──────────────────────────────────────

    async def transfer(
        self,
        amount_minor: int,
        currency: str,
        phone: str,
        reference_id: str,
        payee_message: str = "",
        payer_message: str = "Sikasem susu payout",
    ) -> dict:
        """
        Send payout to circle recipient's MoMo wallet.
        2% MoMo fee is pre-deducted from gross amount before calling this.
        """
        token = await self._get_disbursement_token()
        x_ref = str(uuid.uuid4())
        amount_major = amount_minor / 100
        msisdn = self._normalise_phone(phone, "233")

        payload = {
            "amount": str(amount_major),
            "currency": currency,
            "externalId": reference_id,
            "payee": {"partyIdType": "MSISDN", "partyId": msisdn},
            "payerMessage": payer_message[:160],
            "payeeNote": payee_message[:160],
        }

        async with httpx.AsyncClient() as client:
            r = await self._post_with_retry(
                client,
                f"{self.base_url}/disbursement/v1_0/transfer",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Reference-Id": x_ref,
                    "X-Target-Environment": self.env,
                    "Ocp-Apim-Subscription-Key": settings.MOMO_DISBURSEMENT_PRIMARY_KEY,
                    "X-Callback-Url": f"{settings.MOMO_CALLBACK_HOST}/webhooks/momo/disbursement",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code not in (202, 200):
                logger.error("MoMo transfer failed: %s", r.status_code)
                raise MoMoError(f"Transfer failed: {r.status_code}")

        logger.info("MoMo transfer sent: ref=%s phone=%s amount=%s", x_ref, msisdn, amount_major)
        return {"x_reference_id": x_ref, "status": "PENDING"}

    async def verify_wallet(self, phone: str) -> dict:
        """Check if a MoMo wallet number is active before payout."""
        token = await self._get_collection_token()
        msisdn = self._normalise_phone(phone, "233")
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/collection/v1_0/accountholder/msisdn/{msisdn}/active",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Target-Environment": self.env,
                    "Ocp-Apim-Subscription-Key": settings.MOMO_COLLECTION_PRIMARY_KEY,
                },
            )
            return {"active": r.status_code == 200, "phone": phone}

    # ── Webhook validation ────────────────────────────────────────────

    def validate_webhook_signature(
        self,
        payload: bytes,
        signature: str,
        timestamp: Optional[str] = None,
    ) -> bool:
        """
        Validate MTN MoMo webhook HMAC-SHA256 signature.
        Rejects replays older than 5 minutes when timestamp header is present.
        """
        # Timestamp replay guard
        if timestamp:
            try:
                ts = int(timestamp)
                if abs(int(time.time()) - ts) > 300:
                    logger.warning("MoMo webhook replay rejected: timestamp age > 300s")
                    return False
            except (ValueError, TypeError):
                return False

        # Use dedicated webhook secret if configured, fallback to primary key
        secret = (settings.MOMO_WEBHOOK_SECRET or settings.MOMO_COLLECTION_PRIMARY_KEY).encode()
        expected = hmac.new(secret, payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _normalise_phone(phone: str, country_code: str) -> str:
        """Convert 0XXXXXXXXX → 233XXXXXXXXX for Ghana."""
        phone = phone.strip().replace(" ", "").replace("-", "")
        if phone.startswith("0"):
            phone = country_code + phone[1:]
        elif phone.startswith("+"):
            phone = phone[1:]
        return phone

    @staticmethod
    def calculate_fee(gross_minor: int, fee_pct: float = 2.0) -> int:
        """Calculate MoMo disbursement fee (2%)."""
        return round(gross_minor * fee_pct / 100)


class MoMoError(Exception):
    pass


# Singleton
momo_service = MoMoService()
