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


def test_run_startup_migrations_adds_column_and_promotes_first_user() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    _seed_legacy_users_table(engine)

    run_startup_migrations(engine)

    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("users")}
    assert "is_admin" in columns

    with engine.connect() as connection:
        rows = connection.execute(text("SELECT email, is_admin FROM users ORDER BY created_at ASC")).all()

    assert rows, "Expected at least one user row"
    assert [bool(row.is_admin) for row in rows] == [True, False]


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
        rows = connection.execute(text("SELECT email, is_admin FROM users ORDER BY created_at ASC")).all()

    assert [bool(row.is_admin) for row in rows] == [True, False]


def test_run_startup_migrations_adds_error_category_column_to_cards() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE error_categories (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TABLE cards (
                    id VARCHAR PRIMARY KEY,
                    title VARCHAR NOT NULL,
                    owner_id VARCHAR NOT NULL,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )

    run_startup_migrations(engine)

    inspector = inspect(engine)
    columns = {column["name"]: column for column in inspector.get_columns("cards")}
    assert "error_category_id" in columns
    assert columns["error_category_id"]["nullable"] is True


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
        rows = connection.execute(text("SELECT email, is_admin FROM users ORDER BY created_at ASC")).all()

    assert [bool(row.is_admin) for row in rows] == [True, False]


def test_run_startup_migrations_adds_api_credentials_model_column() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE api_credentials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider VARCHAR NOT NULL UNIQUE,
                    encrypted_secret TEXT NOT NULL,
                    secret_hint VARCHAR,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_by_id VARCHAR,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO api_credentials (provider, encrypted_secret, secret_hint, is_active)
                VALUES (:provider, :encrypted_secret, :secret_hint, :is_active)
                """
            ),
            {
                "provider": "openai",
                "encrypted_secret": "ciphertext",
                "secret_hint": "sk-***",
                "is_active": True,
            },
        )

    run_startup_migrations(engine)

    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("api_credentials")}
    assert "model" in columns

    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT model FROM api_credentials WHERE provider = :provider"),
            {"provider": "openai"},
        ).one()

    assert row.model == migrations.settings.chatgpt_model
