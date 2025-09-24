from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import create_engine, inspect, text

import app.migrations as migrations
from app.migrations import run_startup_migrations


def _seed_legacy_users_table(engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR NOT NULL,
                    password_hash VARCHAR NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        base_time = datetime.now(timezone.utc) - timedelta(days=1)
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, is_active, created_at, updated_at)
                VALUES (:id, :email, :password_hash, :is_active, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-1",
                "email": "owner@example.com",
                "password_hash": "hash1",
                "is_active": True,
                "created_at": base_time,
                "updated_at": base_time,
            },
        )
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, is_active, created_at, updated_at)
                VALUES (:id, :email, :password_hash, :is_active, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-2",
                "email": "member@example.com",
                "password_hash": "hash2",
                "is_active": True,
                "created_at": base_time + timedelta(hours=1),
                "updated_at": base_time + timedelta(hours=1),
            },
        )


def test_run_startup_migrations_adds_column_without_promoting_users() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    _seed_legacy_users_table(engine)

    run_startup_migrations(engine)

    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    assert "is_admin" in columns

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT email, is_admin FROM users ORDER BY created_at ASC")
        ).all()

    assert rows, "Expected at least one user row"
    assert all(bool(row.is_admin) is False for row in rows)


def test_run_startup_migrations_is_noop_when_column_exists() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR NOT NULL,
                    password_hash VARCHAR NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    is_admin BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        base_time = datetime.now(timezone.utc) - timedelta(days=1)
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, is_active, is_admin, created_at, updated_at)
                VALUES (:id, :email, :password_hash, :is_active, :is_admin, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-1",
                "email": "admin@example.com",
                "password_hash": "hash1",
                "is_active": True,
                "is_admin": True,
                "created_at": base_time,
                "updated_at": base_time,
            },
        )
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, is_active, is_admin, created_at, updated_at)
                VALUES (:id, :email, :password_hash, :is_active, :is_admin, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-2",
                "email": "member@example.com",
                "password_hash": "hash2",
                "is_active": True,
                "is_admin": False,
                "created_at": base_time + timedelta(hours=1),
                "updated_at": base_time + timedelta(hours=1),
            },
        )

    run_startup_migrations(engine)

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT email, is_admin FROM users ORDER BY created_at ASC")
        ).all()

    assert [bool(row.is_admin) for row in rows] == [True, False]


def test_run_startup_migrations_handles_duplicate_column_race() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE users (
                    id VARCHAR PRIMARY KEY,
                    email VARCHAR NOT NULL,
                    password_hash VARCHAR NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    is_admin BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        base_time = datetime.now(timezone.utc) - timedelta(days=1)
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, is_active, is_admin, created_at, updated_at)
                VALUES (:id, :email, :password_hash, :is_active, :is_admin, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-1",
                "email": "admin@example.com",
                "password_hash": "hash1",
                "is_active": True,
                "is_admin": True,
                "created_at": base_time,
                "updated_at": base_time,
            },
        )
        connection.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, is_active, is_admin, created_at, updated_at)
                VALUES (:id, :email, :password_hash, :is_active, :is_admin, :created_at, :updated_at)
                """
            ),
            {
                "id": "user-2",
                "email": "member@example.com",
                "password_hash": "hash2",
                "is_active": True,
                "is_admin": False,
                "created_at": base_time + timedelta(hours=1),
                "updated_at": base_time + timedelta(hours=1),
            },
        )

    original_column_names = migrations._column_names
    call_tracker = {"count": 0}

    def fake_column_names(inspector, table_name):
        columns = original_column_names(inspector, table_name)
        if table_name == "users" and call_tracker["count"] == 0:
            call_tracker["count"] += 1
            return {column for column in columns if column != "is_admin"}
        return columns

    with patch("app.migrations._column_names", side_effect=fake_column_names):
        run_startup_migrations(engine)

    with engine.connect() as connection:
        rows = connection.execute(
            text("SELECT email, is_admin FROM users ORDER BY created_at ASC")
        ).all()

    assert [bool(row.is_admin) for row in rows] == [True, False]
