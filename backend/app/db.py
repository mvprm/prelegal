"""SQLite access, and keeping the database's schema up to date.

The schema is built by the numbered SQL files in `migrations/` (`0001_initial.sql`, ...).
The database records how many it has applied in its `user_version`, so every start applies
just the new ones, each in a transaction. To change the schema, add the next file; never
edit one that has been released, since databases that already applied it would not rerun it.
"""

import logging
import re
import sqlite3
from contextlib import closing
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).with_name("migrations")

log = logging.getLogger(__name__)


class DatabaseVersionError(RuntimeError):
    """The database does not match the migrations this version of Prelegal has."""


def connect(path: Path) -> sqlite3.Connection:
    """Opens the database with rows readable by column name and foreign keys enforced.

    The connection may be used from another thread than the one that opened it: FastAPI
    opens a request's connection in one worker thread and may run the endpoint in another.
    It is still never used by two threads at once, since each request opens its own. A
    write waits up to 5 seconds (sqlite3's default timeout) for another to finish.
    """
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def migrate_database(path: Path, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Creates the database at `path` if there is none, and applies the migrations it has
    not had yet. Returns the file names of those it applied."""
    migrations = _migrations(migrations_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    applied = []
    # closing() matters: an open connection would keep the file locked on Windows.
    with closing(connect(path)) as conn:
        conn.isolation_level = None  # the transactions below are explicit
        _use_wal(conn)
        # Both in one statement, so they agree even if another process is migrating it too.
        version, tables = conn.execute(
            "SELECT (SELECT user_version FROM pragma_user_version), (SELECT COUNT(*) FROM sqlite_master)"
        ).fetchone()
        if version > len(migrations):
            raise DatabaseVersionError(
                f"{path} has {version} migrations applied, but this version of Prelegal knows only "
                f"{len(migrations)}. Run a newer version of Prelegal."
            )
        if version == 0 and tables:
            raise DatabaseVersionError(
                f"{path} was made before Prelegal kept its database, when it was recreated on every "
                "start. Delete it, or start once with PRELEGAL_RESET_DB=true."
            )
        for number, migration in enumerate(migrations[version:], start=version + 1):
            if _apply(conn, number, migration.read_text(encoding="utf-8")):
                log.info("Applied database migration %s", migration.name)
                applied.append(migration.name)
    return applied


def delete_database(path: Path) -> None:
    """Deletes the database at `path` and SQLite's side files, if there are any."""
    for suffix in ("", "-journal", "-wal", "-shm"):
        Path(f"{path}{suffix}").unlink(missing_ok=True)


def _migrations(migrations_dir: Path) -> list[Path]:
    """The migration files in order. They must be numbered 0001, 0002, ... without gaps."""
    files = sorted(migrations_dir.glob("*.sql"))
    for number, file in enumerate(files, start=1):
        if not re.fullmatch(rf"{number:04d}_\w+\.sql", file.name):
            raise DatabaseVersionError(f"Expected migration {number:04d}_*.sql, found {file.name}")
    return files


def _use_wal(conn: sqlite3.Connection) -> None:
    """Switches to write-ahead logging, so reading and writing no longer wait for each other.
    The file keeps the setting. While another process has a new file open, the switch fails
    rather than waits; one of the processes, or the next start, then makes it."""
    try:
        conn.execute("PRAGMA journal_mode = WAL")
    except sqlite3.OperationalError as e:
        log.info("Database not switched to write-ahead logging this time: %s", e)


def _statements(script: str) -> list[str]:
    """The SQL statements in a script, whole even when they hold semicolons (in strings or
    triggers). The last may lack its semicolon; comments alone run as nothing."""
    statements, start = [], 0
    for end, char in enumerate(script, start=1):
        if char == ";" and sqlite3.complete_statement(script[start:end]):
            statements.append(script[start:end])
            start = end
    if script[start:].strip():
        statements.append(script[start:])
    return statements


def _version(conn: sqlite3.Connection) -> int:
    """How many migrations the database has applied."""
    return conn.execute("PRAGMA user_version").fetchone()[0]


def _apply(conn: sqlite3.Connection, number: int, script: str) -> bool:
    """Runs migration `number` and records it in one transaction, so a failure leaves nothing
    behind. Returns False if another process starting at the same time applied it first."""
    conn.execute("BEGIN IMMEDIATE")
    try:
        if _version(conn) >= number:
            conn.execute("ROLLBACK")
            return False
        # One statement at a time: executescript() would commit first.
        for statement in _statements(script):
            conn.execute(statement)
        conn.execute(f"PRAGMA user_version = {number}")
        conn.execute("COMMIT")
        return True
    except BaseException:
        if conn.in_transaction:
            conn.execute("ROLLBACK")
        raise
