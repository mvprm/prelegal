import pytest
from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_wrong_method_is_a_json_405(client: TestClient) -> None:
    response = client.get("/api/auth/signin")
    assert response.status_code == 405
    assert response.json() == {"detail": "Method Not Allowed"}


@pytest.mark.parametrize("path", ["/api/", "/api/does-not-exist"])
def test_unknown_api_path_is_a_json_404(client: TestClient, path: str) -> None:
    response = client.get(path)
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_api_docs_live_under_api(client: TestClient) -> None:
    assert client.get("/api/docs").status_code == 200
    schema = client.get("/api/openapi.json").json()
    assert schema["servers"] == [{"url": "/api"}]
    assert {"/auth/signup", "/auth/signin", "/auth/signout", "/auth/me", "/chat", "/documents/{id}"} <= set(schema["paths"])
