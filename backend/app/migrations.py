from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from .config import settings


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
            connection.execute(text(f"ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT {false_literal}"))
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
        first_user = connection.execute(text(f"SELECT id FROM users ORDER BY {ordering_column} ASC LIMIT 1")).first()
        if not first_user:
            return

        connection.execute(
            text("UPDATE users SET is_admin = :true WHERE id = :user_id"),
            {"true": True, "user_id": first_user.id},
        )


def _profile_column_types(dialect_name: str) -> dict[str, str]:
    base_types = {
        "nickname": "VARCHAR(64)",
        "experience_years": "INTEGER",
        "roles": "JSON",
        "bio": "TEXT",
        "avatar_image": "BLOB",
        "avatar_mime_type": "VARCHAR(64)",
    }

    if dialect_name == "postgresql":
        base_types["roles"] = "JSONB"

    if dialect_name == "sqlite":
        base_types["roles"] = "TEXT"

    return base_types


def _ensure_user_profile_columns(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "users"):
            return

        existing_columns = _column_names(inspector, "users")
        column_types = _profile_column_types(engine.dialect.name)

        for column_name, column_type in column_types.items():
            if column_name in existing_columns:
                continue

            try:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"))
            except SQLAlchemyError as exc:
                if not _is_duplicate_column_error(exc):
                    raise

        if "roles" in _column_names(inspector, "users"):
            connection.execute(
                text("UPDATE users SET roles = :empty WHERE roles IS NULL"),
                {"empty": "[]"},
            )


def _datetime_column_type(dialect_name: str) -> str:
    if dialect_name == "postgresql":
        return "TIMESTAMP WITH TIME ZONE"
    if dialect_name == "mysql":
        return "DATETIME(6)"
    return "DATETIME"


def _ensure_completion_timestamps(engine: Engine) -> None:
    column_type = _datetime_column_type(engine.dialect.name)

    with engine.connect() as connection:
        inspector = inspect(connection)
        tables = {
            table: _column_names(inspector, table) for table in ("cards", "subtasks") if _table_exists(inspector, table)
        }

    for table_name, columns in tables.items():
        if "completed_at" in columns:
            continue

        try:
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN completed_at {column_type}"))
        except SQLAlchemyError as exc:
            if not _is_duplicate_column_error(exc):
                raise


def _ensure_card_error_category_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "cards"):
            return

        if not _table_exists(inspector, "error_categories"):
            # Older installs may not have created the error_categories table yet. Skip
            # until a later startup once Base.metadata.create_all has run so the
            # foreign key target exists.
            return

        column_names = _column_names(inspector, "cards")

    if "error_category_id" in column_names:
        return

    dialect = engine.dialect.name
    column_type = "TEXT" if dialect == "sqlite" else "VARCHAR"
    # Keep the inline REFERENCES clause so ON DELETE SET NULL behaves consistently for
    # PostgreSQL/MySQL, matching the ORM definition.
    add_column_sql = (
        "ALTER TABLE cards "
        "ADD COLUMN error_category_id "
        f"{column_type} REFERENCES error_categories(id) ON DELETE SET NULL"
    )

    try:
        with engine.begin() as connection:
            connection.execute(text(add_column_sql))
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise


def _ensure_comment_subtask_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "comments"):
            return

        column_names = _column_names(inspector, "comments")

    if "subtask_id" in column_names:
        return

    column_type = "VARCHAR(64)"

    try:
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE comments ADD COLUMN subtask_id {column_type}"))
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise


def _drop_status_report_report_date(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "status_reports"):
            return

        columns = _column_names(inspector, "status_reports")

    if "report_date" not in columns:
        return

    dialect = engine.dialect.name

    drop_unique_sql = None
    if dialect == "postgresql":
        drop_unique_sql = "ALTER TABLE status_reports DROP CONSTRAINT IF EXISTS uq_status_report_owner_date"
    elif dialect == "mysql":
        drop_unique_sql = "ALTER TABLE status_reports DROP INDEX uq_status_report_owner_date"

    if drop_unique_sql:
        try:
            with engine.begin() as connection:
                connection.execute(text(drop_unique_sql))
        except SQLAlchemyError:
            pass

    try:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE status_reports DROP COLUMN report_date"))
        return
    except SQLAlchemyError:
        pass

    fallback_sql: list[str] = []
    if dialect == "postgresql":
        fallback_sql = [
            "ALTER TABLE status_reports ALTER COLUMN report_date DROP NOT NULL",
            "UPDATE status_reports SET report_date = NULL",
        ]
    elif dialect == "mysql":
        fallback_sql = [
            "ALTER TABLE status_reports MODIFY COLUMN report_date DATE NULL",
            "UPDATE status_reports SET report_date = NULL",
        ]
    elif dialect == "sqlite":
        fallback_sql = ["UPDATE status_reports SET report_date = NULL"]

    for statement in fallback_sql:
        try:
            with engine.begin() as connection:
                connection.execute(text(statement))
        except SQLAlchemyError:
            continue


def _rename_daily_report_tables(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        daily_reports_exists = _table_exists(inspector, "daily_reports")
        status_reports_exists = _table_exists(inspector, "status_reports")

    if not daily_reports_exists:
        return

    dialect = engine.dialect.name

    def rename_table(connection, old: str, new: str) -> None:
        if dialect == "mysql":
            connection.execute(text(f"RENAME TABLE {old} TO {new}"))
        else:
            connection.execute(text(f"ALTER TABLE {old} RENAME TO {new}"))

    # ruff: noqa: S608 - table and column names are controlled constants
    def merge_rows(connection, old: str, new: str) -> None:
        inspector = inspect(connection)
        old_columns = _column_names(inspector, old)
        new_columns = _column_names(inspector, new)
        shared_columns = sorted(old_columns & new_columns)
        if not shared_columns:
            return

        column_list = ", ".join(shared_columns)
        select_list = ", ".join(f"old.{column}" for column in shared_columns)
        merge_sql = text(
            f"INSERT INTO {new} ({column_list}) "
            f"SELECT {select_list} FROM {old} AS old "
            f"LEFT JOIN {new} AS new ON new.id = old.id "
            "WHERE new.id IS NULL"
        )
        connection.execute(merge_sql)

    def drop_table(connection, table_name: str) -> None:
        connection.execute(text(f"DROP TABLE IF EXISTS {table_name}"))

    with engine.begin() as connection:
        inspector = inspect(connection)
        if not status_reports_exists:
            rename_table(connection, "daily_reports", "status_reports")
        else:
            merge_rows(connection, "daily_reports", "status_reports")

        child_tables = (
            ("daily_report_cards", "status_report_cards"),
            ("daily_report_events", "status_report_events"),
        )

        for old_name, new_name in child_tables:
            inspector = inspect(connection)
            if not _table_exists(inspector, old_name):
                continue

            if not _table_exists(inspector, new_name):
                rename_table(connection, old_name, new_name)
                continue

            merge_rows(connection, old_name, new_name)
            drop_table(connection, old_name)

        inspector = inspect(connection)
        if status_reports_exists and _table_exists(inspector, "daily_reports"):
            drop_table(connection, "daily_reports")


def _ensure_api_credentials_model_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "api_credentials"):
            return

        column_names = _column_names(inspector, "api_credentials")

    if "model" in column_names:
        return

    dialect = engine.dialect.name
    column_type = "TEXT" if dialect == "sqlite" else "VARCHAR(255)"

    try:
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE api_credentials ADD COLUMN model {column_type}"))
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise

    default_model = settings.chatgpt_model
    if not default_model:
        return

    with engine.begin() as connection:
        connection.execute(
            text("UPDATE api_credentials SET model = :model WHERE model IS NULL"),
            {"model": default_model},
        )


def run_startup_migrations(engine: Engine) -> None:
    """Ensure database upgrades that rely on application startup are applied."""

    _ensure_users_is_admin_column(engine)
    _ensure_user_profile_columns(engine)
    _promote_first_user_to_admin(engine)
    _ensure_completion_timestamps(engine)
    _ensure_card_error_category_column(engine)
    _ensure_comment_subtask_column(engine)
    _rename_daily_report_tables(engine)
    _drop_status_report_report_date(engine)
    _ensure_api_credentials_model_column(engine)


__all__: Iterable[str] = ["run_startup_migrations"]
