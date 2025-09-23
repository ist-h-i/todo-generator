from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_names(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _false_literal(dialect_name: str) -> str:
    return "FALSE" if dialect_name == "postgresql" else "0"


def _ensure_users_is_admin_column(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "users"):
            return

        if "is_admin" in _column_names(inspector, "users"):
            return

        false_literal = _false_literal(connection.dialect.name)
        connection.execute(
            text(
                f"ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT {false_literal}"
            )
        )
        connection.execute(
            text("UPDATE users SET is_admin = :false WHERE is_admin IS NULL"),
            {"false": False},
        )


def _promote_first_user_to_admin(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "users"):
            return

        if "is_admin" not in _column_names(inspector, "users"):
            return

        admin_exists = connection.execute(
            text("SELECT 1 FROM users WHERE is_admin = :true LIMIT 1"),
            {"true": True},
        ).first()
        if admin_exists:
            return

        column_names = _column_names(inspector, "users")
        ordering_column = "created_at" if "created_at" in column_names else "id"
        first_user = connection.execute(
            text(f"SELECT id FROM users ORDER BY {ordering_column} ASC LIMIT 1")
        ).first()
        if not first_user:
            return

        connection.execute(
            text("UPDATE users SET is_admin = :true WHERE id = :user_id"),
            {"true": True, "user_id": first_user.id},
        )


def run_startup_migrations(engine: Engine) -> None:
    """Ensure database upgrades that rely on application startup are applied."""

    _ensure_users_is_admin_column(engine)
    _promote_first_user_to_admin(engine)


__all__: Iterable[str] = ["run_startup_migrations"]
