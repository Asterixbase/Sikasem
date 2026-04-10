"""
Sikasem API — v1.3
FastAPI retail backend: inventory, sales, credit, tax, vault
"""
import logging
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.services.scheduler import start_scheduler, stop_scheduler

from app.api import (
    health, auth, products, categories, sales, transactions,
    momo, credit, inventory, reports, reorder, tax, vault,
    ocr, shops, admin, notifications, seed, ai,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Sentry ─────────────────────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.05,
        send_default_pii=False,
    )

# ── Rate limiter ───────────────────────────────────────────────────────────────
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["300/minute"],
    storage_uri=settings.REDIS_URL,
)


# ── Security headers middleware ────────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if not settings.is_dev:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ── App lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Sikasem API starting (env=%s)", settings.ENVIRONMENT)
    await init_db()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Sikasem API shutting down")


# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Sikasem API",
    version="1.3.0",
    description="Retail inventory & sales backend for Sikasem",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.is_dev else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


# ── Global error handler ───────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc), "trace": traceback.format_exc()},
    )


# ── Health check (no /v1 prefix — used by Fly.io) ─────────────────────────────
app.include_router(health.router, prefix="/health", tags=["health"])

# ── Versioned API ──────────────────────────────────────────────────────────────
from fastapi import APIRouter
v1 = APIRouter(prefix="/v1")

v1.include_router(auth.router,         prefix="/auth",         tags=["auth"])
v1.include_router(products.router,     prefix="/products",     tags=["products"])
v1.include_router(categories.router,   prefix="/categories",   tags=["categories"])
v1.include_router(sales.router,        prefix="/sales",        tags=["sales"])
v1.include_router(transactions.router, prefix="/transactions/search", tags=["transactions"])
v1.include_router(momo.router,         prefix="/momo",         tags=["momo"])
v1.include_router(credit.router,       prefix="/credit",       tags=["credit"])
v1.include_router(inventory.router,    prefix="/inventory",    tags=["inventory"])
v1.include_router(inventory.stock_router, prefix="/stock",    tags=["stock"])
v1.include_router(reports.router,      prefix="/reports",      tags=["reports"])
v1.include_router(reorder.router,      prefix="/reorder",      tags=["reorder"])
v1.include_router(tax.router,          prefix="/tax",          tags=["tax"])
v1.include_router(vault.router,        prefix="/treasury",     tags=["treasury"])
v1.include_router(ocr.router,          prefix="/ocr",          tags=["ocr"])
v1.include_router(shops.router,        prefix="/shops",        tags=["shops"])
v1.include_router(admin.router,        prefix="/admin",        tags=["admin"])
v1.include_router(admin.security_router, prefix="/security",  tags=["security"])
v1.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
v1.include_router(seed.router,          prefix="/admin",        tags=["seed"])
v1.include_router(ai.router,            prefix="/ai",           tags=["ai"])

app.include_router(v1)
