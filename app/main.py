"""
Sikasem API — Production Backend
FastAPI + Supabase + MTN MoMo + GLICO/Enterprise Life Insurance
"""
from contextlib import asynccontextmanager
import uuid
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.core.config import settings
from app.core.database import init_db
from app.api import (
    auth, circles, members, collections, payouts,
    insurance, guarantors, currencies, webhooks, health
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_is_dev = settings.ENVIRONMENT == "development"

# ── Sentry ────────────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[FastApiIntegration(), SqlalchemyIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,   # never send user PII to Sentry
    )

# ── Rate limiter ──────────────────────────────────────────────────────
_redis_url = settings.REDIS_URL
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri=_redis_url,
)


# ── Security headers middleware ───────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response


# ── Request ID middleware ─────────────────────────────────────────────
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Sikasem API...")
    await init_db()
    yield
    logger.info("Shutting down Sikasem API...")


app = FastAPI(
    title="Sikasem API",
    version="2.0.0",
    description="Digital susu circle management — West Africa",
    lifespan=lifespan,
    docs_url="/docs" if _is_dev else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _is_dev else None,
)

# ── Rate limiter setup ────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware (order matters — outermost added last) ─────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Idempotency-Key"],
)

if settings.ENVIRONMENT in ("staging", "production"):
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

# ── Global exception handler (prevent detail leakage) ────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred. Please try again later."},
    )

# ── Routers ────────────────────────────────────────────────────────────
app.include_router(health.router,      prefix="/health",      tags=["health"])
app.include_router(auth.router,        prefix="/auth",        tags=["auth"])
app.include_router(circles.router,     prefix="/circles",     tags=["circles"])
app.include_router(members.router,     prefix="/members",     tags=["members"])
app.include_router(collections.router, prefix="/collections", tags=["collections"])
app.include_router(payouts.router,     prefix="/payouts",     tags=["payouts"])
app.include_router(insurance.router,   prefix="/insurance",   tags=["insurance"])
app.include_router(guarantors.router,  prefix="/guarantors",  tags=["guarantors"])
app.include_router(currencies.router,  prefix="/currencies",  tags=["currencies"])
app.include_router(webhooks.router,    prefix="/webhooks",    tags=["webhooks"])
