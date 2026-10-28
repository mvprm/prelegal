"""SQLite access. The database is temporary: it starts empty every time the app starts."""

import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def connect(path: Path) -> sqlite3.Connection:
    """Opens the database with rows readable by column name and foreign keys enforced."""
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def reset_database(path: Path) -> None:
    """Deletes the database at `path`, if any, and creates an empty one from schema.sql."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # Remove SQLite's side files too, so nothing from a previous run is replayed.
    for suffix in ("", "-journal", "-wal", "-shm"):
        Path(f"{path}{suffix}").unlink(missing_ok=True)
    # closing() matters: an open connection would keep the file locked on Windows.
    with closing(connect(path)) as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
