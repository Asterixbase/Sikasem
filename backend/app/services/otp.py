"""
OTP service — sends SMS via Twilio when credentials are configured.
In development (or when Twilio is not configured), OTP is logged to console
and the dev bypass code "000000" always passes verification.
"""
import logging
import re
from datetime import datetime, timedelta, timezone

import phonenumbers

from app.core.config import settings
from app.core.security import generate_otp, hash_otp

logger = logging.getLogger(__name__)


def normalize_phone(raw: str) -> str:
    """Normalize to E.164 format. Supports +233... and 0... (Ghana default)."""
    raw = raw.strip()
    try:
        # If no country code prefix, assume Ghana (+233)
        if raw.startswith("0"):
            raw = "+233" + raw[1:]
        parsed = phonenumbers.parse(raw, None)
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError("Invalid phone number")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        raise ValueError(f"Cannot normalize phone number: {raw!r}")


def otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=10)


async def send_otp(phone_e164: str, code: str) -> None:
    if settings.twilio_enabled:
        _send_twilio(phone_e164, code)
    else:
        logger.info("NO-SMS MODE — OTP for %s: %s  (bypass code: 000000)", phone_e164, code)


def _send_twilio(phone_e164: str, code: str) -> None:
    from twilio.rest import Client
    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    client.messages.create(
        body=f"Your Sikasem verification code is: {code}. Valid for 10 minutes.",
        from_=settings.TWILIO_FROM_NUMBER,
        to=phone_e164,
    )
    logger.info("OTP SMS sent to %s", phone_e164)
