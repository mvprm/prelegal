"""Integration tests against the real LLM (OpenRouter, Cerebras). They need OPENROUTER_API_KEY,
from the environment or the repository's .env file, and are skipped without it."""

import os
from datetime import date
from pathlib import Path

import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient

from app.config import Settings
from app.documents import Catalog

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


def test_chooses_the_document_and_keeps_what_the_user_said(user_client: TestClient) -> None:
    body = ask(user_client, "We're Acme Inc. and need a mutual NDA with Globex LLC. Delaware law.")

    assert body["documentId"] == "mutual-nda"
    values = body["values"]
    assert values["party1.company"].startswith("Acme Inc")
    assert "Globex" in values["party2.company"]
    assert values["governingLaw"] == "Delaware"
    assert values["effectiveDate"] == "2026-10-28"
    assert "?" in body["reply"]


def test_captures_the_purpose_and_both_parties_from_the_first_message(user_client: TestClient) -> None:
    # PL-9: the model used to keep the default Purpose here, in every run.
    body = ask(
        user_client,
        "We're Acme Inc and need an NDA with Globex LLC to evaluate a possible partnership. I'm Jane Doe, "
        "CEO, notices to legal@acme.com. Globex signs through Hank Scorpio, President, legal@globex.com.",
    )

    assert body["documentId"] == "mutual-nda"
    values = body["values"]
    assert "partnership" in values["purpose"].lower()
    assert values["party1.name"] == "Jane Doe"
    assert values["party1.title"] == "CEO"
    assert values["party1.noticeAddress"] == "legal@acme.com"
    assert values["party2.name"] == "Hank Scorpio"
    assert values["party2.title"] == "President"
    assert values["party2.noticeAddress"] == "legal@globex.com"
    # Fields the user did not mention keep their defaults.
    assert values["effectiveDate"] == "2026-10-28"
    assert values["mndaTerm"] == "expires"


def test_keeps_a_default_the_user_wants(user_client: TestClient) -> None:
    # A draft chosen with a card holds only its defaults, so the model does not see their values;
    # it once filled in the Purpose field's example instead of keeping the default.
    values = Catalog.load(Settings().documents_path).require("mutual-nda").default_values(date(2026, 10, 28))
    response = user_client.post(
        "/api/chat",
        json={
            "messages": [
                GREETING,
                {"role": "user", "content": "I'd like to draft a Mutual Non-Disclosure Agreement."},
                {"role": "assistant", "content": "Great! Who are the two parties?"},
                {"role": "user", "content": "What does the MNDA term mean? The default purpose is fine, keep it."},
            ],
            "documentId": "mutual-nda",
            "values": values,
            "today": "2026-10-28",
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["values"] == values


def test_explains_an_unsupported_document(user_client: TestClient) -> None:
    body = ask(user_client, "I need an employment contract for a new engineer.")

    assert body["documentId"] is None
    assert body["values"] == {}
    assert "?" in body["reply"]
