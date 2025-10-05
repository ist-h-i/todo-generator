from __future__ import annotations

from typing import Iterator, Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool

from .config import settings

Base = declarative_base()

# Lazy singletons to avoid import-time failures on serverless cold starts
_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def _normalized_url(url: str) -> str:
    # Accept both postgres:// and postgresql://
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def _create_engine() -> Engine:
    return create_engine(
        _normalized_url(settings.database_url),
        pool_pre_ping=True,
        poolclass=NullPool,  # serverless-friendly (no persistent pool)
        future=True,
    )


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = _create_engine()
    return _engine


def _get_session_factory() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
            future=True,
        )
    return _SessionLocal


def get_db() -> Iterator[Session]:
    """Yield a DB session per request."""
    db = _get_session_factory()()
    try:
        yield db
    finally:
        db.close()


# Backwards-compatible handles expected by the rest of the application
engine = get_engine()
SessionLocal = _get_session_factory()
