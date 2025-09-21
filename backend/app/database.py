from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings


def _create_engine():
    connect_args = {}
    if settings.database_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
    return create_engine(settings.database_url, future=True, connect_args=connect_args)


def _create_session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_engine():
    return _create_engine()


engine = get_engine()
SessionLocal = _create_session_factory(engine)
Base = declarative_base()


def get_db() -> Generator:
    """Provide a transactional scope around a series of operations."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
