from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    JWT_EXPIRE_DAYS: int = 7

    # Environment
    ENVIRONMENT: str = "development"

    # Twilio OTP
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # Redis
    REDIS_URL: str = "memory://"

    # Sentry
    SENTRY_DSN: str = ""

    # CORS & Hosts
    ALLOWED_HOSTS: str = "localhost"
    CORS_ORIGINS: str = "http://localhost:3000"

    # MoMo
    MOMO_SUBSCRIPTION_KEY: str = ""
    MOMO_API_USER: str = ""
    MOMO_API_KEY: str = ""
    MOMO_ENVIRONMENT: str = "sandbox"

    # Anthropic (Claude Vision OCR)
    ANTHROPIC_API_KEY: str = ""

    @property
    def allowed_hosts_list(self) -> List[str]:
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",")]

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def is_dev(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def twilio_enabled(self) -> bool:
        return bool(self.TWILIO_ACCOUNT_SID and self.TWILIO_AUTH_TOKEN)

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
