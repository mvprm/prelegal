"""Integration tests against the real LLM (OpenRouter, Cerebras). They need OPENROUTER_API_KEY,
from the environment or the repository's .env file, and are skipped without it."""

import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
API_KEY = os.environ.get("OPENROUTER_API_KEY") or dotenv_values(ENV_FILE).get("OPENROUTER_API_KEY")

pytestmark = pytest.mark.skipif(not API_KEY, reason="OPENROUTER_API_KEY is not set")

GREETING = {"role": "assistant", "content": "Hi! What would you like to draft, and with whom?"}


@pytest.fixture(autouse=True)
def api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", API_KEY or "")


def ask(client: TestClient, text: str) -> dict:
    response = client.post(
        "/api/chat",
        json={
            "messages": [GREETING, {"role": "user", "content": text}],
            "documentId": None,
            "values": {},
            "today": "2026-10-28",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_chooses_the_document_and_keeps_what_the_user_said(client: TestClient) -> None:
    body = ask(client, "We're Acme Inc. and need a mutual NDA with Globex LLC. Delaware law.")

    assert body["documentId"] == "mutual-nda"
    values = body["values"]
    assert values["party1.company"].startswith("Acme Inc")
    assert "Globex" in values["party2.company"]
    assert values["governingLaw"] == "Delaware"
    assert values["effectiveDate"] == "2026-10-28"
    assert "?" in body["reply"]


def test_explains_an_unsupported_document(client: TestClient) -> None:
    body = ask(client, "I need an employment contract for a new engineer.")

    assert body["documentId"] is None
    assert body["values"] == {}
    assert "?" in body["reply"]
