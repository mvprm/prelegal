import sqlite3
from collections.abc import Iterator
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app import accounts
from app.accounts import SESSION_LIFETIME, EmailTakenError, User
from app.db import connect, reset_database

NOW = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)


@pytest.fixture
def db(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    path = tmp_path / "prelegal.db"
    reset_database(path)
    with closing(connect(path)) as conn:
        yield conn


def test_password_hashes_are_salted_and_verifiable() -> None:
    first, second = accounts.hash_password("correct horse"), accounts.hash_password("correct horse")
    assert first != second
    assert first.startswith("scrypt$") and "correct horse" not in first
    assert accounts.verify_password("correct horse", first)
    assert accounts.verify_password("correct horse", second)
    assert not accounts.verify_password("Correct horse", first)


@pytest.mark.parametrize("stored", ["", "hash", "bcrypt$1$2$3$00$00", "scrypt$x$8$1$00$00", "scrypt$16384$8$1$zz$00"])
def test_malformed_hashes_never_verify(stored: str) -> None:
    assert not accounts.verify_password("correct horse", stored)


def test_create_and_authenticate(db: sqlite3.Connection) -> None:
    user = accounts.create_user(db, "ada@example.com", "correct horse")
    assert user == User(1, "ada@example.com")
    assert accounts.authenticate(db, "ada@example.com", "correct horse") == user
    assert accounts.authenticate(db, "ADA@example.com", "correct horse") == user
    assert accounts.authenticate(db, "ada@example.com", "wrong horse") is None
    assert accounts.authenticate(db, "grace@example.com", "correct horse") is None


def test_emails_are_taken_ignoring_case(db: sqlite3.Connection) -> None:
    accounts.create_user(db, "ada@example.com", "correct horse")
    with pytest.raises(EmailTakenError):
        accounts.create_user(db, "Ada@Example.com", "another horse")


def test_sessions_last_until_they_expire_or_end(db: sqlite3.Connection) -> None:
    user = accounts.create_user(db, "ada@example.com", "correct horse")
    token = accounts.start_session(db, user, NOW)

    assert accounts.session_user(db, token, NOW) == user
    assert accounts.session_user(db, token, NOW + SESSION_LIFETIME / 2) == user
    assert accounts.session_user(db, token, NOW + SESSION_LIFETIME) is None
    assert accounts.session_user(db, token + "x", NOW) is None

    accounts.end_session(db, token)
    assert accounts.session_user(db, token, NOW) is None


def test_only_a_hash_of_the_session_token_is_stored(db: sqlite3.Connection) -> None:
    user = accounts.create_user(db, "ada@example.com", "correct horse")
    token = accounts.start_session(db, user, NOW)
    stored = db.execute("SELECT token_hash FROM sessions").fetchone()["token_hash"]
    assert token not in stored and len(stored) == 64


def test_starting_a_session_clears_expired_ones(db: sqlite3.Connection) -> None:
    user = accounts.create_user(db, "ada@example.com", "correct horse")
    accounts.start_session(db, user, NOW)
    accounts.start_session(db, user, NOW + SESSION_LIFETIME)
    assert db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 1
