"""Database connection — async SQLAlchemy + Supabase."""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from supabase import create_client, Client
from app.core.config import settings

_is_dev = settings.ENVIRONMENT == "development"

# ── SQLAlchemy async engine ───────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=_is_dev,                  # SQL logging only in development
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=1800,             # recycle connections every 30 min
    connect_args={
        "server_settings": {
            "statement_timeout": "30000",        # 30 s query timeout
            "application_name": "sikasem-api",
        }
    },
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


# ── Supabase client (for auth + realtime + storage) ───────────────────
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,  # service role for server-side
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        # Import all models so they're registered
        from app.models import (  # noqa: F401
            User, Circle, CircleMember, Transaction, InsurancePolicy,
            InsuranceClaim, GuarantorAgreement, CurrencyRate,
            CyclePayment, CyclePayout,
        )
