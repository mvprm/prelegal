"""Integration test against the real LLM (OpenRouter, Cerebras). It needs OPENROUTER_API_KEY,
from the environment or the repository's .env file, and is skipped without it."""

import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient

from nda_samples import DEFAULT_FIELDS

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
API_KEY = os.environ.get("OPENROUTER_API_KEY") or dotenv_values(ENV_FILE).get("OPENROUTER_API_KEY")

pytestmark = pytest.mark.skipif(not API_KEY, reason="OPENROUTER_API_KEY is not set")


def test_chat_with_the_real_llm(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", API_KEY or "")
    message = (
        "We're Acme Inc. and the other side is Globex LLC. I'm Jane Doe, CEO of Acme, "
        "notices to jane@acme.com. Delaware law please."
    )
    response = client.post(
        "/api/nda/chat",
        json={
            "messages": [
                {"role": "assistant", "content": "Hi! Who are the two parties to this NDA?"},
                {"role": "user", "content": message},
            ],
            "fields": DEFAULT_FIELDS,
            "today": "2026-10-28",
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["reply"].strip()
    fields = body["fields"]
    assert fields["party1"]["company"] == "Acme Inc."
    assert fields["party1"]["name"] == "Jane Doe"
    assert fields["party1"]["noticeAddress"] == "jane@acme.com"
    assert "Globex" in fields["party2"]["company"]
    assert fields["governingLaw"] == "Delaware"
    # Nothing the user did not mention is made up.
    assert fields["party2"]["name"] == ""
    assert fields["effectiveDate"] == "2026-10-28"
