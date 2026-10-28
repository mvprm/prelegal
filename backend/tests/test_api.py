import pytest
from fastapi.testclient import TestClient

VALID_CREDENTIALS = {"email": "ada@example.com", "password": "correct horse"}


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize(
    ("path", "detail"),
    [
        ("/api/auth/signup", "Sign up is not implemented yet"),
        ("/api/auth/signin", "Sign in is not implemented yet"),
    ],
)
def test_auth_endpoints_are_placeholders(client: TestClient, path: str, detail: str) -> None:
    response = client.post(path, json=VALID_CREDENTIALS)
    assert response.status_code == 501
    assert response.json() == {"detail": detail}


@pytest.mark.parametrize("path", ["/api/auth/signup", "/api/auth/signin"])
@pytest.mark.parametrize(
    "body",
    [
        {},
        {"email": "ada@example.com"},
        {"password": "correct horse"},
        {"email": "not-an-email", "password": "correct horse"},
        {"email": "ada@example.com", "password": ""},
    ],
)
def test_auth_endpoints_validate_the_request(client: TestClient, path: str, body: dict) -> None:
    assert client.post(path, json=body).status_code == 422


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
    assert "/auth/signup" in schema["paths"]
