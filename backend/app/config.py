"""Runtime settings, read from the environment.

The defaults point at the repository layout, so the backend runs locally without any
configuration. The Docker image overrides them (see the Dockerfile).
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
_TRUE = {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    db_path: Path = BACKEND_DIR / "data" / "prelegal.db"
    """SQLite database file. Created if missing, and brought up to date, when the app starts."""

    reset_db: bool = False
    """Deletes the database every time the app starts, so it starts empty (for development)."""

    static_dir: Path = BACKEND_DIR.parent / "frontend" / "out"
    """The frontend's static export (`npm run build`). Optional: without it only the API runs."""

    documents_path: Path = BACKEND_DIR.parent / "documents.json"
    """The supported documents and their fields, shared with the frontend."""

    secure_cookies: bool = False
    """Marks the session cookie Secure, so browsers send it over HTTPS only. Turn it on when
    the app is served over HTTPS; the default suits http://localhost."""

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "Settings":
        """Settings with `PRELEGAL_DB_PATH`, `PRELEGAL_RESET_DB`, `PRELEGAL_STATIC_DIR`,
        `PRELEGAL_DOCUMENTS_PATH` and `PRELEGAL_SECURE_COOKIES` overriding the defaults. The flags
        are true for 1, true, yes or on, and false otherwise."""
        defaults = cls()
        return cls(
            db_path=Path(env.get("PRELEGAL_DB_PATH", defaults.db_path)),
            reset_db=env.get("PRELEGAL_RESET_DB", str(defaults.reset_db)).lower() in _TRUE,
            static_dir=Path(env.get("PRELEGAL_STATIC_DIR", defaults.static_dir)),
            documents_path=Path(env.get("PRELEGAL_DOCUMENTS_PATH", defaults.documents_path)),
            secure_cookies=env.get("PRELEGAL_SECURE_COOKIES", str(defaults.secure_cookies)).lower() in _TRUE,
        )
