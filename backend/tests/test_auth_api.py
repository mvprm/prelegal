from contextlib import closing

import pytest
from conftest import PASSWORD, sign_up
from fastapi.testclient import TestClient

from app.api.deps import SESSION_COOKIE
from app.config import Settings
from app.db import connect


def test_sign_up_creates_an_account_and_signs_in(client: TestClient) -> None:
    response = sign_up(client, " Ada@Example.com ")

    assert response.status_code == 201
    assert response.json() == {"email": "ada@example.com"}
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and "Path=/" in cookie
    assert "Secure" not in cookie
    assert client.get("/api/auth/me").json() == {"email": "ada@example.com"}


def test_passwords_are_stored_hashed(client: TestClient, settings: Settings) -> None:
    sign_up(client)
    with closing(connect(settings.db_path)) as conn:
        stored = conn.execute("SELECT password_hash FROM users").fetchone()["password_hash"]
    assert PASSWORD not in stored


def test_sign_up_refuses_a_taken_email(client: TestClient) -> None:
    sign_up(client)
    response = sign_up(TestClient(client.app), "ADA@example.com")
    assert response.status_code == 409
    assert response.json() == {"detail": "There is already an account with this email. Sign in instead."}


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"email": "ada@example.com"},
        {"password": PASSWORD},
        {"email": "not-an-email", "password": PASSWORD},
        {"email": "ada@example.com", "password": "short"},
        {"email": "ada@example.com", "password": "x" * 129},
    ],
)
def test_sign_up_validates_the_request(client: TestClient, body: dict) -> None:
    assert client.post("/api/auth/signup", json=body).status_code == 422


def test_sign_in_starts_a_new_session(user_client: TestClient) -> None:
    browser = TestClient(user_client.app)
    assert browser.get("/api/auth/me").status_code == 401

    response = browser.post("/api/auth/signin", json={"email": "ADA@example.com", "password": PASSWORD})

    assert response.status_code == 200
    assert response.json() == {"email": "ada@example.com"}
    assert browser.get("/api/auth/me").json() == {"email": "ada@example.com"}


@pytest.mark.parametrize(
    "credentials",
    [
        {"email": "ada@example.com", "password": "wrong horse"},
        {"email": "nobody@example.com", "password": PASSWORD},
    ],
)
def test_sign_in_rejects_wrong_credentials_without_saying_which(user_client: TestClient, credentials: dict) -> None:
    browser = TestClient(user_client.app)
    response = browser.post("/api/auth/signin", json=credentials)
    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}
    assert "set-cookie" not in response.headers


def test_sign_out_ends_the_session(user_client: TestClient) -> None:
    token = user_client.cookies[SESSION_COOKIE]

    response = user_client.post("/api/auth/signout")

    assert response.status_code == 204
    assert user_client.get("/api/auth/me").status_code == 401
    # The old token no longer works even if a browser kept it.
    replay = TestClient(user_client.app, cookies={SESSION_COOKIE: token})
    assert replay.get("/api/auth/me").status_code == 401


def test_sign_out_without_a_session_is_harmless(client: TestClient) -> None:
    assert client.post("/api/auth/signout").status_code == 204


@pytest.mark.parametrize("cookies", [{}, {SESSION_COOKIE: "made-up"}])
def test_me_needs_a_valid_session(client: TestClient, cookies: dict) -> None:
    response = TestClient(client.app, cookies=cookies).get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Please sign in to continue."}


def test_cookies_can_be_marked_secure(tmp_path, static_dir) -> None:
    from app.main import create_app

    settings = Settings(db_path=tmp_path / "prelegal.db", static_dir=static_dir, secure_cookies=True)
    with TestClient(create_app(settings), base_url="https://testserver") as client:
        assert "Secure" in sign_up(client).headers["set-cookie"]
