from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, bindparam, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from .config import settings
from .services.workspace_template_defaults import (
    DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD,
    DEFAULT_TEMPLATE_DESCRIPTION,
    DEFAULT_TEMPLATE_FIELD_VISIBILITY,
    DEFAULT_TEMPLATE_NAME,
)


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_names(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _false_literal(dialect_name: str) -> str:
    return "FALSE" if dialect_name == "postgresql" else "0"


def _string_column_type(dialect_name: str) -> str:
    return "TEXT" if dialect_name == "sqlite" else "VARCHAR(255)"


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


def _backfill_user_nickname(engine: Engine) -> None:
    """Backfill missing user nicknames with a stable default.

    Uses the format "user-{id}" to ensure every existing user row has a non-empty
    nickname without introducing new dependencies or uniqueness constraints.
    """
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "users"):
            return

        if "nickname" not in _column_names(inspector, "users"):
            return

    # Populate nickname only where it's NULL or empty.
    with engine.begin() as connection:
        dialect = engine.dialect.name
        if dialect == "sqlite":
            # SQLite uses || for concatenation
            connection.execute(
                text(
                    "UPDATE users SET nickname = 'user-' || id "
                    "WHERE nickname IS NULL OR nickname = ''"
                )
            )
        else:
            # PostgreSQL/MySQL: use CONCAT for portability
            connection.execute(
                text(
                    "UPDATE users SET nickname = CONCAT('user-', id) "
                    "WHERE nickname IS NULL OR nickname = ''"
                )
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

    column_type = _string_column_type(engine.dialect.name)
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


def _ensure_card_ai_failure_reason_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "cards"):
            return

        column_names = _column_names(inspector, "cards")

    if "ai_failure_reason" in column_names:
        return

    column_type = "TEXT"

    try:
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE cards ADD COLUMN ai_failure_reason {column_type}"))
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise


def _ensure_card_ai_similarity_vector_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "cards"):
            return

        column_names = _column_names(inspector, "cards")

    if "ai_similarity_vector_id" in column_names:
        return

    column_type = _string_column_type(engine.dialect.name)

    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE cards "
                    "ADD COLUMN ai_similarity_vector_id "
                    f"{column_type}"
                )
            )
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


def _ensure_channel_tables(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        # If users table doesn't exist yet, let ORM create tables later
        if not _table_exists(inspector, "users"):
            return
        channels_exists = _table_exists(inspector, "channels")
        members_exists = _table_exists(inspector, "channel_members")

    if not channels_exists:
        with engine.begin() as connection:
            dialect = engine.dialect.name
            string_type = _string_column_type(dialect)
            datetime_type = _datetime_column_type(dialect)
            bool_default = _false_literal(dialect)
            connection.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS channels ("
                    " id "
                    f"{string_type} PRIMARY KEY,"
                    " name "
                    f"{string_type} NOT NULL,"
                    " owner_user_id "
                    f"{string_type} NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
                    " is_private BOOLEAN NOT NULL DEFAULT "
                    f"{bool_default},"
                    " created_at "
                    f"{datetime_type},"
                    " updated_at "
                    f"{datetime_type}"
                    ")"
                )
            )

    if not members_exists:
        with engine.begin() as connection:
            dialect = engine.dialect.name
            string_type = _string_column_type(dialect)
            datetime_type = _datetime_column_type(dialect)
            connection.execute(
                text(
                    "CREATE TABLE IF NOT EXISTS channel_members ("
                    " id "
                    f"{string_type} PRIMARY KEY,"
                    " channel_id "
                    f"{string_type} NOT NULL REFERENCES channels(id) ON DELETE CASCADE,"
                    " user_id "
                    f"{string_type} NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
                    " role "
                    f"{string_type} NOT NULL,"
                    " created_at "
                    f"{datetime_type},"
                    " updated_at "
                    f"{datetime_type}"
                    ")"
                )
            )
            # Unique constraint (channel_id, user_id)
            try:
                connection.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_user ON channel_members (channel_id, user_id)"
                    )
                )
            except SQLAlchemyError:
                pass


def _ensure_card_channel_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "cards"):
            return
        column_names = _column_names(inspector, "cards")

    if "channel_id" in column_names:
        return

    dialect = engine.dialect.name
    string_type = _string_column_type(dialect)

    # Keep FK-like reference for consistency with ORM (best-effort across dialects)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE cards "
                    "ADD COLUMN channel_id "
                    f"{string_type} REFERENCES channels(id) ON DELETE SET NULL"
                )
            )
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise


def _ensure_private_channels_and_backfill(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "users") or not _table_exists(inspector, "channels"):
            return

        # Load users
        users = connection.execute(text("SELECT id, email FROM users")).fetchall()
        if not users:
            return

        now = datetime.now(timezone.utc)

        # Ensure private channel and membership for each user
        for row in users:
            user_id = row.id
            existing = connection.execute(
                text(
                    "SELECT id FROM channels WHERE owner_user_id = :uid AND is_private = :priv LIMIT 1"
                ),
                {"uid": user_id, "priv": True},
            ).first()

            if existing:
                channel_id = existing.id
            else:
                channel_id = str(uuid4())
                connection.execute(
                    text(
                        "INSERT INTO channels (id, name, owner_user_id, is_private, created_at, updated_at) "
                        "VALUES (:id, :name, :owner, :priv, :created, :updated)"
                    ),
                    {
                        "id": channel_id,
                        "name": "My Channel",
                        "owner": user_id,
                        "priv": True,
                        "created": now,
                        "updated": now,
                    },
                )

            # Ensure membership
            member_exists = connection.execute(
                text(
                    "SELECT 1 FROM channel_members WHERE channel_id = :cid AND user_id = :uid LIMIT 1"
                ),
                {"cid": channel_id, "uid": user_id},
            ).first()
            if not member_exists:
                connection.execute(
                    text(
                        "INSERT INTO channel_members (id, channel_id, user_id, role, created_at, updated_at) "
                        "VALUES (:id, :cid, :uid, :role, :created, :updated)"
                    ),
                    {
                        "id": str(uuid4()),
                        "cid": channel_id,
                        "uid": user_id,
                        "role": "owner",
                        "created": now,
                        "updated": now,
                    },
                )

        # Backfill cards.channel_id from card owner private channel
        if _table_exists(inspector, "cards"):
            connection.execute(
                text(
                    "UPDATE cards SET channel_id = ("
                    "  SELECT c.id FROM channels c"
                    "  WHERE c.owner_user_id = cards.owner_id AND c.is_private = :priv"
                    "  LIMIT 1"
                    ") WHERE (channel_id IS NULL OR channel_id = '') AND owner_id IS NOT NULL"
                ),
                {"priv": True},
            )


def _backfill_owner_from_cards(connection, table: str, owner_column: str) -> None:
    inspector = inspect(connection)
    if not _table_exists(inspector, "cards"):
        return

    card_columns = _column_names(inspector, "cards")
    if "owner_id" not in card_columns:
        return

    if table == "labels":
        if not _table_exists(inspector, "card_labels"):
            return
        join_sql = " ".join(
            [
                "SELECT cards.owner_id FROM card_labels",
                "JOIN cards ON cards.id = card_labels.card_id",
                "WHERE card_labels.label_id = labels.id",
                "AND cards.owner_id IS NOT NULL LIMIT 1",
            ]
        )
    elif table == "statuses":
        join_sql = " ".join(
            [
                "SELECT owner_id FROM cards",
                "WHERE cards.status_id = statuses.id",
                "AND owner_id IS NOT NULL LIMIT 1",
            ]
        )
    else:
        return

    update_sql = " ".join(
        [
            f"UPDATE {table} SET {owner_column} = ({join_sql})",
            f"WHERE {owner_column} IS NULL",
        ]
    )
    connection.execute(text(update_sql))


def _backfill_card_owner(connection) -> None:
    inspector = inspect(connection)
    if not _table_exists(inspector, "cards"):
        return

    card_columns = _column_names(inspector, "cards")
    if "owner_id" not in card_columns:
        return

    if _table_exists(inspector, "statuses"):
        status_columns = _column_names(inspector, "statuses")
    else:
        status_columns = set()

    if "status_id" in card_columns and "owner_id" in status_columns:
        connection.execute(
            text(
                "UPDATE cards "
                "SET owner_id = ("
                "    SELECT statuses.owner_id FROM statuses "
                "    WHERE statuses.id = cards.status_id "
                "      AND statuses.owner_id IS NOT NULL"
                "    LIMIT 1"
                ") "
                "WHERE owner_id IS NULL"
            )
        )

    fallback_owner = _fallback_owner_id(connection)
    if fallback_owner:
        connection.execute(
            text("UPDATE cards SET owner_id = :owner WHERE owner_id IS NULL"),
            {"owner": fallback_owner},
        )


def _fallback_owner_id(connection) -> str | None:
    inspector = inspect(connection)
    if not _table_exists(inspector, "users"):
        return None

    owner = connection.execute(text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")).scalar()
    if owner:
        return owner
    return connection.execute(text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).scalar()


def _ensure_status_owner_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "statuses"):
            return

        column_names = _column_names(inspector, "statuses")

    if "owner_id" in column_names:
        return

    column_type = _string_column_type(engine.dialect.name)

    try:
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE statuses ADD COLUMN owner_id {column_type}"))
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise

    with engine.begin() as connection:
        _backfill_owner_from_cards(connection, "statuses", "owner_id")
        fallback_owner = _fallback_owner_id(connection)
        if fallback_owner:
            connection.execute(
                text("UPDATE statuses SET owner_id = :owner WHERE owner_id IS NULL"),
                {"owner": fallback_owner},
            )


def _ensure_card_owner_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "cards"):
            return

        column_names = _column_names(inspector, "cards")
        users_exists = _table_exists(inspector, "users")

    if "owner_id" not in column_names:
        column_type = _string_column_type(engine.dialect.name)
        references_clause = " REFERENCES users(id) ON DELETE CASCADE" if users_exists else ""

        try:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE cards " "ADD COLUMN owner_id " f"{column_type}{references_clause}")
                )
        except SQLAlchemyError as exc:
            if not _is_duplicate_column_error(exc):
                raise

    with engine.begin() as connection:
        _backfill_card_owner(connection)


def _ensure_label_owner_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "labels"):
            return

        column_names = _column_names(inspector, "labels")

    if "owner_id" in column_names:
        return

    column_type = _string_column_type(engine.dialect.name)

    try:
        with engine.begin() as connection:
            connection.execute(text(f"ALTER TABLE labels ADD COLUMN owner_id {column_type}"))
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise

    with engine.begin() as connection:
        _backfill_owner_from_cards(connection, "labels", "owner_id")
        fallback_owner = _fallback_owner_id(connection)
        if fallback_owner:
            connection.execute(
                text("UPDATE labels SET owner_id = :owner WHERE owner_id IS NULL"),
                {"owner": fallback_owner},
            )


def _ensure_card_initiative_column(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "cards"):
            return

        column_names = _column_names(inspector, "cards")
        has_initiatives = _table_exists(inspector, "improvement_initiatives")

    if "initiative_id" in column_names:
        return

    column_type = _string_column_type(engine.dialect.name)

    if has_initiatives:
        add_column_sql = (
            "ALTER TABLE cards "
            "ADD COLUMN initiative_id "
            f"{column_type} REFERENCES improvement_initiatives(id) ON DELETE SET NULL"
        )
    else:
        add_column_sql = f"ALTER TABLE cards ADD COLUMN initiative_id {column_type}"

    try:
        with engine.begin() as connection:
            connection.execute(text(add_column_sql))
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise


def _ensure_workspace_template_default_flag(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "workspace_templates"):
            return

        column_names = _column_names(inspector, "workspace_templates")

    if "is_system_default" in column_names:
        return

    false_literal = _false_literal(engine.dialect.name)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE workspace_templates "
                    "ADD COLUMN is_system_default BOOLEAN NOT NULL "
                    f"DEFAULT {false_literal}"
                )
            )
    except SQLAlchemyError as exc:
        if not _is_duplicate_column_error(exc):
            raise

    with engine.begin() as connection:
        connection.execute(
            text("UPDATE workspace_templates " "SET is_system_default = :false " "WHERE is_system_default IS NULL"),
            {"false": False},
        )


def _ensure_workspace_default_templates(engine: Engine) -> None:
    with engine.connect() as connection:
        inspector = inspect(connection)
        if not _table_exists(inspector, "users"):
            return
        if not _table_exists(inspector, "workspace_templates"):
            return

        template_columns = _column_names(inspector, "workspace_templates")
        if "is_system_default" not in template_columns:
            return

    timestamp = datetime.now(timezone.utc)
    insert_statement = (
        text(
            "INSERT INTO workspace_templates ("
            "id, owner_id, name, description, default_status_id, default_label_ids, "
            "confidence_threshold, field_visibility, is_system_default, created_at, updated_at"
            ") VALUES ("
            ":id, :owner_id, :name, :description, :default_status_id, :default_label_ids, "
            ":confidence_threshold, :field_visibility, :is_system_default, :created_at, :updated_at"
            ")"
        )
        .bindparams(bindparam("default_label_ids", type_=JSON))
        .bindparams(bindparam("field_visibility", type_=JSON))
    )

    with engine.begin() as connection:
        missing_users = connection.execute(
            text(
                "SELECT users.id "
                "FROM users "
                "WHERE NOT EXISTS ("
                "    SELECT 1 FROM workspace_templates "
                "    WHERE workspace_templates.owner_id = users.id "
                "      AND workspace_templates.is_system_default = :true"
                ")"
            ),
            {"true": True},
        ).fetchall()

        if not missing_users:
            return

        for row in missing_users:
            connection.execute(
                insert_statement,
                {
                    "id": str(uuid4()),
                    "owner_id": row.id,
                    "name": DEFAULT_TEMPLATE_NAME,
                    "description": DEFAULT_TEMPLATE_DESCRIPTION,
                    "default_status_id": None,
                    "default_label_ids": [],
                    "confidence_threshold": DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD,
                    "field_visibility": dict(DEFAULT_TEMPLATE_FIELD_VISIBILITY),
                    "is_system_default": True,
                    "created_at": timestamp,
                    "updated_at": timestamp,
                },
            )


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

    default_model = settings.gemini_model
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
    _backfill_user_nickname(engine)
    _promote_first_user_to_admin(engine)
    _ensure_completion_timestamps(engine)
    _ensure_card_error_category_column(engine)
    _ensure_card_ai_failure_reason_column(engine)
    _ensure_card_ai_similarity_vector_column(engine)
    _ensure_comment_subtask_column(engine)
    _ensure_card_owner_column(engine)
    _ensure_status_owner_column(engine)
    _ensure_label_owner_column(engine)
    _ensure_card_initiative_column(engine)
    _rename_daily_report_tables(engine)
    _drop_status_report_report_date(engine)
    _ensure_workspace_template_default_flag(engine)
    _ensure_workspace_default_templates(engine)
    _ensure_api_credentials_model_column(engine)
    _ensure_channel_tables(engine)
    _ensure_card_channel_column(engine)
    _ensure_private_channels_and_backfill(engine)


__all__: Iterable[str] = ["run_startup_migrations"]
