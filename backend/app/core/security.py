import hashlib
import hmac
import random
import string
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"


# ── OTP — use HMAC-SHA256 (no bcrypt needed for short-lived 6-digit codes) ───

def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def hash_otp(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


def verify_otp_hash(code: str, hashed: str) -> bool:
    expected = hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_jwt(user_id: str, shop_id: str, phone: str, role: str = "owner") -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "shop_id": shop_id,
        "phone": phone,
        "role": role,
        "exp": expire,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)
    return token, expire


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}
