from pathlib import Path

from app.config import BACKEND_DIR, Settings


def test_defaults_follow_the_repository_layout() -> None:
    settings = Settings.from_env({})
    assert settings.db_path == BACKEND_DIR / "data" / "prelegal.db"
    assert settings.static_dir == BACKEND_DIR.parent / "frontend" / "out"
    assert settings.documents_path == BACKEND_DIR.parent / "documents.json"
    assert settings.secure_cookies is False


def test_environment_overrides_the_defaults() -> None:
    settings = Settings.from_env(
        {
            "PRELEGAL_DB_PATH": "/data/prelegal.db",
            "PRELEGAL_STATIC_DIR": "/app/static",
            "PRELEGAL_DOCUMENTS_PATH": "/app/documents.json",
            "PRELEGAL_SECURE_COOKIES": "true",
        }
    )
    assert settings.db_path == Path("/data/prelegal.db")
    assert settings.static_dir == Path("/app/static")
    assert settings.documents_path == Path("/app/documents.json")
    assert settings.secure_cookies is True
