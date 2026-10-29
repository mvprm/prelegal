from collections.abc import Iterator
from pathlib import Path

import httpx
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


PASSWORD = "correct horse"


def sign_up(client: TestClient, email: str = "ada@example.com", password: str = PASSWORD) -> httpx.Response:
    return client.post("/api/auth/signup", json={"email": email, "password": password})


@pytest.fixture
def user_client(client: TestClient) -> TestClient:
    """`client`, signed in to a new account (ada@example.com). It keeps the session cookie."""
    assert sign_up(client).status_code == 201
    return client


@pytest.fixture
def other_client(user_client: TestClient) -> TestClient:
    """A second browser on the same app, signed in to another account (grace@example.com)."""
    # Not entered as a context manager, so the app's lifespan (which resets the database) does not run again.
    other = TestClient(user_client.app)
    assert sign_up(other, "grace@example.com").status_code == 201
    return other
