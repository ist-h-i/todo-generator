#!/usr/bin/env python3
"""Create or update the application database schema.

This helper uses the SQLAlchemy models defined in ``backend.app.models`` to
create the base schema and then executes the idempotent startup migrations so
that existing databases are upgraded to match the latest expectations.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Iterable, NoReturn

from sqlalchemy import inspect
from sqlalchemy.engine import Engine


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create all database tables defined by the backend models and run "
            "the startup migrations so that the schema matches the latest "
            "application version."
        )
    )
    parser.add_argument(
        "--database-url",
        help=(
            "Database URL to use for the operation. Overrides the DATABASE_URL "
            "environment variable for the duration of this script."
        ),
    )
    parser.add_argument(
        "--provision",
        action="store_true",
        help=(
            "Create any tables that have not yet been provisioned. By default the "
            "script only runs the startup migrations so existing data is never "
            "touched during regular deployments."
        ),
    )
    parser.add_argument(
        "--skip-migrations",
        action="store_true",
        help="Only ensure the schema is present without executing the startup migrations.",
    )
    return parser.parse_args(argv)


def _configure_environment(args: argparse.Namespace) -> None:
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url


def _load_settings() -> None:
    try:
        # Import inside the function so that environment variables are applied
        # before Pydantic validates them.
        import backend.app.config  # noqa: F401
    except ValueError as exc:
        raise SystemExit(f"Configuration error: {exc}") from exc


def _get_engine() -> Engine:
    from backend.app.database import get_engine

    return get_engine()


def _create_schema(engine: Engine, tables: Iterable[str] | None = None) -> None:
    # Import models so that SQLAlchemy is aware of every mapped class prior to
    # issuing ``create_all``.
    from backend.app import models  # noqa: F401
    from backend.app.database import Base

    selected_tables = None
    if tables is not None:
        requested = set(tables)
        selected_tables = [table for table in Base.metadata.sorted_tables if table.name in requested]

    Base.metadata.create_all(bind=engine, tables=selected_tables, checkfirst=True)


def _get_missing_tables(engine: Engine) -> set[str]:
    from backend.app.database import Base

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    defined_tables = {table.name for table in Base.metadata.sorted_tables}
    return defined_tables - existing_tables


def _run_startup_migrations(engine: Engine) -> None:
    from backend.app.migrations import run_startup_migrations

    run_startup_migrations(engine)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    _configure_environment(args)
    _load_settings()
    engine = _get_engine()

    missing_tables = _get_missing_tables(engine)

    if missing_tables:
        if not args.provision:
            missing = ", ".join(sorted(missing_tables))
            raise SystemExit(
                "Schema has not been provisioned yet. Missing tables: "
                f"{missing}. Re-run with --provision when setting up a new deployment."
            )

        print("Provisioning missing tables: " + ", ".join(sorted(missing_tables)))
        _create_schema(engine, missing_tables)
        print("Table provisioning complete.")
    else:
        print("All expected tables are already present; skipping table creation.")

    if args.skip_migrations:
        print("Skipping startup migrations as requested.")
    else:
        print("Running startup migrations...")
        _run_startup_migrations(engine)

    return 0


def _run() -> NoReturn:
    sys.exit(main())


if __name__ == "__main__":
    _run()
