"""Runtime settings, read from the environment.

The defaults point at the repository layout, so the backend runs locally without any
configuration. The Docker image overrides them (see the Dockerfile).
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    db_path: Path = BACKEND_DIR / "data" / "prelegal.db"
    """SQLite database file. Deleted and recreated every time the app starts."""

    static_dir: Path = BACKEND_DIR.parent / "frontend" / "out"
    """The frontend's static export (`npm run build`). Optional: without it only the API runs."""

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "Settings":
        """Settings with `PRELEGAL_DB_PATH` and `PRELEGAL_STATIC_DIR` overriding the defaults."""
        defaults = cls()
        return cls(
            db_path=Path(env.get("PRELEGAL_DB_PATH", defaults.db_path)),
            static_dir=Path(env.get("PRELEGAL_STATIC_DIR", defaults.static_dir)),
        )
