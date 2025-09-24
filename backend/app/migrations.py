from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_names(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _false_literal(dialect_name: str) -> str:
    return "FALSE" if dialect_name == "postgresql" else "0"


_DUPLICATE_COLUMN_TOKENS = (
    "duplicate column",
    "duplicate column name",
    "already exists",
)


def _is_duplicate_column_error(error: SQLAlchemyError) -> bool:
    orig = getattr(error, "orig", error)

    if getattr(orig, "pgcode", None) == "42701":  # PostgreSQL duplicate_column
        return True

    args = getattr(orig, "args", ()) or ()
    for arg in args:
        if isinstance(arg, int) and arg == 1060:  # MySQL duplicate column code
            return True
        if isinstance(arg, str) and any(token in arg.lower() for token in _DUPLICATE_COLUMN_TOKENS):
            return True

    message = str(orig).lower()
    return any(token in message for token in _DUPLICATE_COLUMN_TOKENS)


def _ensure_users_is_admin_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "users"):
            return

        column_names = _column_names(inspector, "users")

    if "is_admin" in column_names:
        return

    false_literal = _false_literal(engine.dialect.name)

    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    f"ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT {false_literal}"
                )
            )
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise

    with engine.begin() as connection:
        inspector = inspect(connection)
        if "is_admin" not in _column_names(inspector, "users"):
            return

        connection.execute(
            text("UPDATE users SET is_admin = :false WHERE is_admin IS NULL"),
            {"false": False},
        )


def run_startup_migrations(engine: Engine) -> None:
    """Ensure database upgrades that rely on application startup are applied."""

    _ensure_users_is_admin_column(engine)


__all__: Iterable[str] = ["run_startup_migrations"]
