import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import connect, reset_database
from app.main import create_app


def add_user(path: Path, email: str) -> None:
    with closing(connect(path)) as conn, conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES (?, 'hash')", (email,))


def table_names(path: Path) -> set[str]:
    with closing(connect(path)) as conn:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {row["name"] for row in rows}


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
    reset_database(db)
    with closing(connect(db)) as conn:
        assert [row["name"] for row in conn.execute(f"PRAGMA table_info({table})")] == columns


def test_deleting_a_user_deletes_their_sessions_and_documents(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    reset_database(db)
    add_user(db, "ada@example.com")
    with closing(connect(db)) as conn, conn:
        conn.execute("INSERT INTO sessions VALUES ('hash', 1, '2099-01-01T00:00:00.000Z')")
        conn.execute("INSERT INTO documents (id, user_id, document_id, values_json) VALUES ('d', 1, 'mutual-nda', '{}')")
        conn.execute("DELETE FROM users")
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0] == 0


def test_users_get_an_id_and_creation_time(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    reset_database(db)
    add_user(db, "ada@example.com")
    with closing(connect(db)) as conn:
        user = conn.execute("SELECT * FROM users").fetchone()
    assert user["id"] == 1
    assert user["created_at"].endswith("Z")


@pytest.mark.parametrize("duplicate", ["ada@example.com", "ADA@Example.com"])
def test_emails_are_unique_ignoring_case(tmp_path: Path, duplicate: str) -> None:
    db = tmp_path / "prelegal.db"
    reset_database(db)
    add_user(db, "ada@example.com")
    with pytest.raises(sqlite3.IntegrityError):
        add_user(db, duplicate)


def test_reset_discards_previous_data_and_tables(tmp_path: Path) -> None:
    db = tmp_path / "prelegal.db"
    reset_database(db)
    add_user(db, "ada@example.com")
    with closing(connect(db)) as conn, conn:
        conn.execute("CREATE TABLE leftover (id INTEGER)")

    reset_database(db)

    assert table_names(db) == {"users", "sessions", "documents", "sqlite_sequence"}
    with closing(connect(db)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_app_starts_with_a_fresh_database(tmp_path: Path, static_dir: Path) -> None:
    settings = Settings(db_path=tmp_path / "prelegal.db", static_dir=static_dir)
    with TestClient(create_app(settings)):
        add_user(settings.db_path, "ada@example.com")

    with TestClient(create_app(settings)):
        with closing(connect(settings.db_path)) as conn:
            assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
