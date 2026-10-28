from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_serves_the_home_page(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.text == "HOME PAGE"


def test_serves_pages_by_directory(client: TestClient) -> None:
    assert client.get("/nda/").text == "NDA PAGE"


def test_redirects_to_the_trailing_slash_path(client: TestClient) -> None:
    response = client.get("/nda", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"].endswith("/nda/")
    assert client.get("/nda").text == "NDA PAGE"


def test_unknown_page_gets_the_exported_404_page(client: TestClient) -> None:
    response = client.get("/no-such-page")
    assert response.status_code == 404
    assert response.text == "NOT FOUND PAGE"


def test_runs_the_api_without_a_frontend_build(tmp_path: Path) -> None:
    settings = Settings(db_path=tmp_path / "prelegal.db", static_dir=tmp_path / "missing")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
