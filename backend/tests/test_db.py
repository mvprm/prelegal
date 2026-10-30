import sqlite3
import threading
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import MIGRATIONS_DIR, DatabaseVersionError, connect, delete_database, migrate_database
from app.main import create_app


def add_user(path: Path, email: str) -> None:
    with closing(connect(path)) as conn, conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES (?, 'hash')", (email,))


def count(path: Path, table: str) -> int:
    with closing(connect(path)) as conn:
        return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def version(path: Path) -> int:
    with closing(connect(path)) as conn:
        return conn.execute("PRAGMA user_version").fetchone()[0]


def write_migrations(directory: Path, *scripts: str) -> Path:
    """Numbered migration files in `directory`, one per script: 0001_step.sql, 0002_step.sql…"""
    directory.mkdir(exist_ok=True)
    for number, script in enumerate(scripts, start=1):
        (directory / f"{number:04d}_step.sql").write_text(script)
    return directory


# The app's own migrations.


@pytest.mark.parametrize(
    ("table", "columns"),
    [
        ("users", ["id", "email", "password_hash", "created_at"]),
        ("sessions", ["token_hash", "user_id", "expires_at"]),
        ("documents", ["id", "user_id", "document_id", "values_json", "title", "created_at", "updated_at"]),
    ],
)
def test_creates_the_tables(tmp_path: Path, table: str, columns: list[str]) -> None:
    db = tmp_path / "nested" / "prelegal.db"
    migrate_database(db)
    with closing(connect(db)) as conn:
        assert [row["name"] for row in conn.execute(f"PRAGMA table_info({table})")] == columns


def test_a_new_database_gets_every_migration(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    migrations = sorted(path.name for path in MIGRATIONS_DIR.glob("*.sql"))

    assert migrate_database(db) == migrations
    assert version(db) == len(migrations)
    assert migrate_database(db) == []  # nothing left to apply
    with closing(connect(db)) as conn:
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"


def test_deleting_a_user_deletes_their_sessions_and_documents(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    migrate_database(db)
    add_user(db, "ada@example.com")
    with closing(connect(db)) as conn, conn:
        conn.execute("INSERT INTO sessions VALUES ('hash', 1, '2099-01-01T00:00:00.000Z')")
        conn.execute("INSERT INTO documents (id, user_id, document_id, values_json) VALUES ('d', 1, 'mutual-nda', '{}')")
        conn.execute("DELETE FROM users")
    assert count(db, "sessions") == 0
    assert count(db, "documents") == 0


def test_users_get_an_id_and_creation_time(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    migrate_database(db)
    add_user(db, "ada@example.com")
    with closing(connect(db)) as conn:
        user = conn.execute("SELECT * FROM users").fetchone()
    assert user["id"] == 1
    assert user["created_at"].endswith("Z")


@pytest.mark.parametrize("duplicate", ["ada@example.com", "ADA@Example.com"])
def test_emails_are_unique_ignoring_case(tmp_path: Path, duplicate: str) -> None:
    db = tmp_path / "prelegal.db"
    migrate_database(db)
    add_user(db, "ada@example.com")
    with pytest.raises(sqlite3.IntegrityError):
        add_user(db, duplicate)


# Applying migrations.


def test_upgrades_an_older_database_keeping_its_data(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    first = "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL);"
    migrate_database(db, write_migrations(tmp_path / "v1", first))
    with closing(connect(db)) as conn, conn:
        conn.execute("INSERT INTO notes (body) VALUES ('kept')")

    second = "ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;"
    assert migrate_database(db, write_migrations(tmp_path / "v2", first, second)) == ["0002_step.sql"]

    assert version(db) == 2
    with closing(connect(db)) as conn:
        assert [tuple(row) for row in conn.execute("SELECT body, pinned FROM notes")] == [("kept", 0)]


def test_a_failing_migration_leaves_nothing_behind(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    first = "CREATE TABLE notes (body TEXT);"
    migrate_database(db, write_migrations(tmp_path / "v1", first))

    broken = "CREATE TABLE tags (name TEXT); INSERT INTO notes (body) VALUES ('x'); INSERT INTO missing VALUES (1);"
    with pytest.raises(sqlite3.OperationalError, match="no such table: missing"):
        migrate_database(db, write_migrations(tmp_path / "v2", first, broken))

    assert version(db) == 1
    assert count(db, "notes") == 0
    with closing(connect(db)) as conn:
        assert conn.execute("SELECT name FROM sqlite_master WHERE name = 'tags'").fetchone() is None

    # Once the migration is fixed, it applies.
    fixed = "CREATE TABLE tags (name TEXT);"
    assert migrate_database(db, write_migrations(tmp_path / "v3", first, fixed)) == ["0002_step.sql"]


def test_migrations_starting_at_once_apply_each_only_once(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    migrations = write_migrations(tmp_path / "m", "CREATE TABLE notes (body TEXT);", "ALTER TABLE notes ADD COLUMN pinned INTEGER;")
    start = threading.Barrier(4)
    applied: list[list[str]] = []
    errors: list[BaseException] = []

    def run() -> None:
        start.wait()
        try:
            applied.append(migrate_database(db, migrations))
        except BaseException as e:
            errors.append(e)

    threads = [threading.Thread(target=run) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert sorted(name for names in applied for name in names) == ["0001_step.sql", "0002_step.sql"]
    assert version(db) == 2


def test_refuses_a_database_newer_than_the_app(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    migrate_database(db, write_migrations(tmp_path / "v2", "CREATE TABLE a (x);", "CREATE TABLE b (x);"))

    with pytest.raises(DatabaseVersionError, match="has 2 migrations applied, but this version of Prelegal knows only 1"):
        migrate_database(db, write_migrations(tmp_path / "v1", "CREATE TABLE a (x);"))
    assert version(db) == 2


def test_refuses_a_database_made_when_it_was_recreated_on_every_start(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    with closing(sqlite3.connect(db)) as conn:
        conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY)")  # tables, but no version

    with pytest.raises(DatabaseVersionError, match="PRELEGAL_RESET_DB=true"):
        migrate_database(db)


def test_statements_may_hold_semicolons(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    script = """
        CREATE TABLE notes (body TEXT); CREATE TABLE log (entry TEXT);  -- two on a line; fine
        CREATE TRIGGER noted AFTER INSERT ON notes BEGIN
            INSERT INTO log VALUES ('a; b');
        END;
        INSERT INTO notes VALUES ('first; note');
        INSERT INTO notes VALUES ('no semicolon at the end')  -- a last comment; with a semicolon
    """
    migrate_database(db, write_migrations(tmp_path / "m", script))
    with closing(connect(db)) as conn:
        assert conn.execute("SELECT entry FROM log").fetchone()[0] == "a; b"
        assert [row[0] for row in conn.execute("SELECT body FROM notes")] == ["first; note", "no semicolon at the end"]


@pytest.mark.parametrize("names", [["0001_a.sql", "0003_c.sql"], ["0001_a.sql", "0001_b.sql"], ["1_a.sql"]])
def test_migrations_must_be_numbered_without_gaps(tmp_path: Path, names: list[str]) -> None:
    for name in names:
        (tmp_path / name).write_text("SELECT 1;")
    with pytest.raises(DatabaseVersionError, match="Expected migration"):
        migrate_database(tmp_path / "prelegal.db", tmp_path)


def test_delete_database_removes_sqlites_side_files(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    migrate_database(db)
    for suffix in ("-wal", "-shm", "-journal"):
        Path(f"{db}{suffix}").write_bytes(b"")

    delete_database(db)

    assert list(tmp_path.iterdir()) == []


# Starting the app.


def test_the_database_survives_a_restart(settings: Settings) -> None:
    with TestClient(create_app(settings)):
        add_user(settings.db_path, "ada@example.com")

    with TestClient(create_app(settings)):
        assert count(settings.db_path, "users") == 1


def test_the_database_starts_empty_when_reset_is_on(tmp_path: Path, static_dir: Path) -> None:
    settings = Settings(db_path=tmp_path / "prelegal.db", static_dir=static_dir, reset_db=True)
    with TestClient(create_app(settings)):
        add_user(settings.db_path, "ada@example.com")

    with TestClient(create_app(settings)):
        assert count(settings.db_path, "users") == 0


def test_expired_sessions_are_deleted_at_start(settings: Settings) -> None:
    migrate_database(settings.db_path)
    add_user(settings.db_path, "ada@example.com")
    now = datetime.now(UTC)
    with closing(connect(settings.db_path)) as conn, conn:
        for token, expires in [("expired", now - timedelta(minutes=1)), ("valid", now + timedelta(days=1))]:
            conn.execute("INSERT INTO sessions VALUES (?, 1, ?)", (token, expires.strftime("%Y-%m-%dT%H:%M:%S.000Z")))

    with TestClient(create_app(settings)), closing(connect(settings.db_path)) as conn:
        assert [row["token_hash"] for row in conn.execute("SELECT token_hash FROM sessions")] == ["valid"]


def test_the_app_does_not_start_with_a_database_newer_than_it(settings: Settings) -> None:
    migrate_database(settings.db_path)
    with closing(connect(settings.db_path)) as conn:
        conn.execute("PRAGMA user_version = 999")

    with pytest.raises(DatabaseVersionError), TestClient(create_app(settings)):
        pass
