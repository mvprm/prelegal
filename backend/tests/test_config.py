from pathlib import Path

from app.config import BACKEND_DIR, Settings


def test_defaults_follow_the_repository_layout() -> None:
    settings = Settings.from_env({})
    assert settings.db_path == BACKEND_DIR / "data" / "prelegal.db"
    assert settings.static_dir == BACKEND_DIR.parent / "frontend" / "out"


def test_environment_overrides_the_defaults() -> None:
    settings = Settings.from_env(
        {"PRELEGAL_DB_PATH": "/data/prelegal.db", "PRELEGAL_STATIC_DIR": "/app/static"}
    )
    assert settings.db_path == Path("/data/prelegal.db")
    assert settings.static_dir == Path("/app/static")
