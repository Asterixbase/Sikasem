"""
Sikasem Configuration — all settings via environment variables.
Copy .env.example → .env and fill in values before running.
"""
from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────
    APP_NAME: str = "Sikasem"
    ENVIRONMENT: str = "development"          # development | staging | production
    SECRET_KEY: str                           # min 64-char random string
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15     # short-lived access tokens
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7        # was 90 — reduced to 7
    ALGORITHM: str = "HS256"

    # ── Database (Supabase) ──────────────────────────────────────────
    SUPABASE_URL: str                         # https://xxx.supabase.co
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str                  # Settings → API → JWT Secret
    DATABASE_URL: str                         # postgresql+asyncpg://...

    # ── MTN MoMo ─────────────────────────────────────────────────────
    MOMO_ENVIRONMENT: str = "sandbox"         # sandbox | production
    MOMO_COLLECTION_PRIMARY_KEY: str
    MOMO_COLLECTION_SECONDARY_KEY: str
    MOMO_COLLECTION_USER_ID: str
    MOMO_COLLECTION_API_KEY: str
    MOMO_DISBURSEMENT_PRIMARY_KEY: str
    MOMO_DISBURSEMENT_SECONDARY_KEY: str
    MOMO_DISBURSEMENT_USER_ID: str
    MOMO_DISBURSEMENT_API_KEY: str
    MOMO_CALLBACK_HOST: str                   # https://api.sikasem.gh
    MOMO_WEBHOOK_SECRET: str = ""             # HMAC secret for webhook validation
    MOMO_FEE_PERCENT: float = 2.0

    # ── GLICO Life Ghana Insurance ───────────────────────────────────
    GLICO_API_URL: str = "https://api.glico.com.gh/v1"
    GLICO_API_KEY: str = ""
    GLICO_PARTNER_ID: str = ""

    # ── Enterprise Life Insurance ────────────────────────────────────
    ENTLIFE_API_URL: str = "https://api.enterpriselife.com.gh/v1"
    ENTLIFE_API_KEY: str = ""
    ENTLIFE_PARTNER_ID: str = ""

    # ── USSD Gateway (Africa's Talking / Hubtel) ─────────────────────
    USSD_PROVIDER: str = "africastalking"     # africastalking | hubtel
    AFRICASTALKING_API_KEY: str = ""
    AFRICASTALKING_USERNAME: str = ""
    AFRICASTALKING_WEBHOOK_SECRET: str = ""   # HMAC for AT callback validation
    HUBTEL_CLIENT_ID: str = ""
    HUBTEL_CLIENT_SECRET: str = ""

    # ── WhatsApp (Twilio) ────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""            # whatsapp:+14155238886

    # ── Push Notifications (Firebase) ───────────────────────────────
    FIREBASE_SERVICE_ACCOUNT_JSON: str = ""   # JSON string

    # ── Redis (caching + rate limiting) ─────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_PASSWORD: str = ""                  # required in staging/production

    # ── Observability ────────────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── Bank of Ghana BoG Sandbox ───────────────────────────────────
    BOG_SANDBOX_URL: str = "https://sandbox.bog.gov.gh/v1"
    BOG_API_KEY: str = ""

    # ── CORS ─────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "https://app.sikasem.gh",
        "https://www.sikasem.gh",
        "http://localhost:3000",
        "http://localhost:19006",    # Expo dev
    ]
    ALLOWED_HOSTS: List[str] = ["api.sikasem.gh", "localhost"]

    # ── Currency defaults ────────────────────────────────────────────
    DEFAULT_CURRENCY: str = "GHS"
    SUPPORTED_CURRENCIES: List[str] = [
        "GHS", "NGN", "XOF", "SLL", "GMD", "GNF", "LRD", "CVE", "MRU", "GBP"
    ]

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_must_be_long(cls, v: str) -> str:
        if len(v) < 64:
            raise ValueError("SECRET_KEY must be at least 64 characters")
        return v

    @field_validator("MOMO_ENVIRONMENT")
    @classmethod
    def momo_environment_valid(cls, v: str) -> str:
        if v not in ("sandbox", "production"):
            raise ValueError("MOMO_ENVIRONMENT must be 'sandbox' or 'production'")
        return v

    @field_validator("ENVIRONMENT")
    @classmethod
    def environment_valid(cls, v: str) -> str:
        if v not in ("development", "staging", "production"):
            raise ValueError("ENVIRONMENT must be development | staging | production")
        return v

    def model_post_init(self, __context) -> None:
        """Cross-field production security checks."""
        if self.ENVIRONMENT in ("staging", "production"):
            if not self.MOMO_WEBHOOK_SECRET:
                raise ValueError(
                    "MOMO_WEBHOOK_SECRET must be set in staging/production "
                    "to validate MoMo webhook signatures"
                )
            if not self.AFRICASTALKING_WEBHOOK_SECRET and self.USSD_PROVIDER == "africastalking":
                raise ValueError(
                    "AFRICASTALKING_WEBHOOK_SECRET must be set in staging/production"
                )

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
