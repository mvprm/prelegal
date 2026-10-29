"""User accounts: passwords and sign-in sessions.

Passwords are hashed with scrypt from the standard library. Signing in starts a session:
a random token that the browser keeps in a cookie and the database keeps only as a
SHA-256 hash, so a copy of the database cannot be used to sign in.
"""

import hashlib
import hmac
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from functools import cache

SESSION_LIFETIME = timedelta(days=7)
"""How long a session lasts. Sessions also end when the app restarts, with the database."""

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128

# scrypt's cost: about 16 MB of memory and a few tens of milliseconds per hash.
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1


class EmailTakenError(ValueError):
    """There is already an account with this email (in any letter case)."""


@dataclass(frozen=True)
class User:
    id: int
    email: str


def hash_password(password: str) -> str:
    """A salted hash of `password`, with its parameters, as `scrypt$n$r$p$salt$hash` in hex."""
    salt = secrets.token_bytes(16)
    digest = _scrypt(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Whether `password` matches a hash made by `hash_password`."""
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = _scrypt(password, bytes.fromhex(salt), int(n), int(r), int(p))
        return hmac.compare_digest(actual, bytes.fromhex(digest))
    except ValueError:
        return False


def create_user(conn: sqlite3.Connection, email: str, password: str) -> User:
    """Adds an account. Raises `EmailTakenError` if the email already has one."""
    try:
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, hash_password(password))
        )
    except sqlite3.IntegrityError:
        raise EmailTakenError(email) from None
    assert cursor.lastrowid is not None
    return User(cursor.lastrowid, email)


def authenticate(conn: sqlite3.Connection, email: str, password: str) -> User | None:
    """The account with this email and password, or None if there is none."""
    row = conn.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None:
        # Hash anyway, so the response time does not reveal which emails have accounts.
        verify_password(password, _unknown_user_hash())
        return None
    if not verify_password(password, row["password_hash"]):
        return None
    return User(row["id"], row["email"])


def start_session(conn: sqlite3.Connection, user: User, now: datetime) -> str:
    """Starts a session for `user` and returns its token, for the cookie."""
    # Expired sessions are no use to anyone; clearing them here keeps the table small.
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (_timestamp(now),))
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (_hash_token(token), user.id, _timestamp(now + SESSION_LIFETIME)),
    )
    return token


def session_user(conn: sqlite3.Connection, token: str, now: datetime) -> User | None:
    """The user signed in with `token`, or None if the session does not exist or has expired."""
    row = conn.execute(
        "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id "
        "WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
        (_hash_token(token), _timestamp(now)),
    ).fetchone()
    return User(row["id"], row["email"]) if row else None


def end_session(conn: sqlite3.Connection, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash_token(token),))


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=64 * 1024 * 1024, dklen=32)


@cache
def _unknown_user_hash() -> str:
    return hash_password(secrets.token_urlsafe())


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _timestamp(moment: datetime) -> str:
    """The same text format as the schema's timestamps, so they compare correctly."""
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
