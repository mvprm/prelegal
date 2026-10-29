from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A miniature frontend export laid out like `next build` output with trailingSlash."""
    out = tmp_path / "out"
    (out / "draft").mkdir(parents=True)
    (out / "index.html").write_text("HOME PAGE")
    (out / "draft" / "index.html").write_text("DRAFT PAGE")
    (out / "404.html").write_text("NOT FOUND PAGE")
    return out


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(db_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    # Entering the client runs the app's lifespan, so the database is created.
    with TestClient(create_app(settings)) as client:
        yield client
