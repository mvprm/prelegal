from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from app import llm

MESSAGES = [{"role": "user", "content": "Hi"}]


class Answer(BaseModel):
    text: str


def reply_with(content: str):
    """A stand-in for LiteLLM's completion() that answers with `content`."""

    def completion(**_kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    return completion


@pytest.fixture(autouse=True)
def api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")


def test_parses_the_structured_reply(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "completion", reply_with('{"text": "Hello"}'))
    assert llm.structured_completion(MESSAGES, Answer) == Answer(text="Hello")


def test_is_not_called_without_an_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY")
    monkeypatch.setattr(llm, "completion", reply_with('{"text": "Hello"}'))
    with pytest.raises(llm.LlmNotConfiguredError):
        llm.structured_completion(MESSAGES, Answer)


def test_wraps_a_reply_in_the_wrong_format(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "completion", reply_with('{"answer": "Hello"}'))
    with pytest.raises(llm.LlmError):
        llm.structured_completion(MESSAGES, Answer)


def test_wraps_provider_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(**_kwargs: object) -> None:
        raise TimeoutError("the provider did not answer")

    monkeypatch.setattr(llm, "completion", fail)
    with pytest.raises(llm.LlmError, match="the provider did not answer"):
        llm.structured_completion(MESSAGES, Answer)
