from datetime import date
from typing import Any

import pytest
from pydantic import BaseModel

from app import llm
from app.chat import Assistant, apply_updates
from app.config import Settings
from app.documents import Catalog

CATALOG = Catalog.load(Settings().documents_path)
NDA = CATALOG.documents["mutual-nda"]
CSA = CATALOG.documents["cloud-service-agreement"]
TODAY = date(2026, 10, 28)
HISTORY = [
    {"role": "assistant", "content": "What would you like to draft?"},
    {"role": "user", "content": "An NDA between Acme Inc. and Globex LLC."},
]


def updates(spec_id: str, **changes: Any) -> dict[str, Any]:
    """An `updates` object with every field null except `changes` (party ones as dicts)."""
    spec = CATALOG.documents[spec_id]
    null_party = {"name": None, "title": None, "company": None, "noticeAddress": None}
    nulls = {f.id: None for f in spec.fields} | {"party1": null_party, "party2": null_party}
    for key in ("party1", "party2"):
        if key in changes:
            changes[key] = null_party | changes[key]
    return nulls | changes


def turn(spec_id: str, reply: str = "Noted.", question: str = "Who signs?", switch_to: str | None = None, **changes: Any):
    return {"reply": reply, "question": question, "switchTo": switch_to, "updates": updates(spec_id, **changes)}


def selection(document_id: str | None, reply: str = "Sure.", question: str = "Shall we start?") -> dict[str, Any]:
    return {"reply": reply, "question": question, "documentId": document_id}


class FakeLlm:
    """Stands in for the real LLM call: records each prompt and returns canned answers in order."""

    def __init__(self, *answers: dict[str, Any] | Exception) -> None:
        self.answers = list(answers)
        self.calls: list[tuple[list[dict[str, str]], type[BaseModel]]] = []

    def __call__(self, messages: list[dict[str, str]], response_model: type[BaseModel]) -> BaseModel:
        self.calls.append((messages, response_model))
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return response_model.model_validate(answer)

    def system_prompt(self, call: int) -> str:
        return self.calls[call][0][0]["content"]


@pytest.fixture
def assistant() -> Assistant:
    return Assistant(CATALOG)


def use(monkeypatch: pytest.MonkeyPatch, fake: FakeLlm) -> FakeLlm:
    monkeypatch.setattr(llm, "structured_completion", fake)
    return fake


class TestChoosingADocument:
    def test_keeps_asking_until_a_document_is_chosen(self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = use(monkeypatch, FakeLlm(selection(None, "Prelegal cannot draft leases.", "Would a Pilot Agreement help?")))

        result = assistant.respond(HISTORY, None, {}, TODAY)

        assert result.reply == "Prelegal cannot draft leases.\n\nWould a Pilot Agreement help?"
        assert result.document_id is None
        assert result.values == {}
        # The selection prompt lists every supported document.
        assert all(spec_id in fake.system_prompt(0) for spec_id in CATALOG.documents)

    def test_starts_the_chosen_document_from_the_whole_conversation(
        self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        fake = use(
            monkeypatch,
            FakeLlm(
                selection("mutual-nda"),
                turn("mutual-nda", party1={"company": "Acme Inc."}, party2={"company": "Globex LLC"}),
            ),
        )

        result = assistant.respond(HISTORY, None, {}, TODAY)

        assert result.document_id == "mutual-nda"
        assert result.reply == "Noted.\n\nWho signs?"
        assert result.values == NDA.default_values(TODAY) | {
            "party1.company": "Acme Inc.",
            "party2.company": "Globex LLC",
        }
        # The second call uses the NDA's own schema and asks for values from the whole chat.
        assert "mndaTermYears" in fake.calls[1][1].model_json_schema()["$defs"]["MutualNdaUpdates"]["properties"]
        assert "anywhere in the conversation" in fake.system_prompt(1)
        # ...and repeats it after the conversation, where the model reliably follows it.
        reminder = fake.calls[1][0][-1]
        assert reminder["role"] == "system"
        assert reminder["content"].startswith("The user has just chosen the Mutual Non-Disclosure Agreement.")


class TestDraftingADocument:
    def test_fills_in_the_updates(self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = use(monkeypatch, FakeLlm(turn("mutual-nda", governingLaw="California", mndaTermYears=2)))
        values = NDA.default_values(TODAY)

        result = assistant.respond(HISTORY, "mutual-nda", values, TODAY)

        assert result.values == values | {"governingLaw": "California", "mndaTermYears": "2"}
        assert "latest message" in fake.system_prompt(0)

    def test_switches_to_another_document_when_asked(self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = use(
            monkeypatch,
            FakeLlm(
                turn("mutual-nda", switch_to="cloud-service-agreement", governingLaw="Ignored"),
                turn("cloud-service-agreement", "Switched.", "What are the fees?", subscriptionPeriod="1 year"),
            ),
        )

        result = assistant.respond(HISTORY, "mutual-nda", NDA.default_values(TODAY), TODAY)

        assert result.document_id == "cloud-service-agreement"
        assert result.values == CSA.default_values(TODAY) | {"subscriptionPeriod": "1 year"}
        assert result.reply == "Switched.\n\nWhat are the fees?"
        assert "Cloud Service Agreement" in fake.system_prompt(1)

    @pytest.mark.parametrize(
        ("values", "expected"),
        [
            ({}, "What should the Governing Law be?"),
            (
                {"governingLaw": "Delaware", "jurisdiction": "courts located in New Castle, DE"}
                | {f.id: "x" for f in NDA.party_fields},
                "Would you like to change anything, or are you ready to download the PDF?",
            ),
        ],
    )
    def test_always_asks_a_question(
        self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch, values: dict[str, str], expected: str
    ) -> None:
        use(monkeypatch, FakeLlm(turn("mutual-nda", reply="Got it.", question="  ")))
        result = assistant.respond(HISTORY, "mutual-nda", NDA.default_values(TODAY) | values, TODAY)
        assert result.reply == f"Got it.\n\n{expected}"

    def test_adds_a_question_to_an_instruction(self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch) -> None:
        use(monkeypatch, FakeLlm(turn("mutual-nda", reply="Got it.", question="Please give me the state.")))
        result = assistant.respond(HISTORY, "mutual-nda", NDA.default_values(TODAY), TODAY)
        assert result.reply == "Got it.\n\nPlease give me the state.\n\nWhat should the Governing Law be?"

    def test_prompt_shows_progress_and_a_calendar(self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = use(monkeypatch, FakeLlm(turn("cloud-service-agreement")))
        assistant.respond(HISTORY, "cloud-service-agreement", CSA.default_values(TODAY) | {"fees": "$1,000 a month"}, TODAY)

        prompt = fake.system_prompt(0)
        assert "Still missing (required): Subscription Period, Governing Law" in prompt
        assert "Optional fields not filled in: Non-Renewal Notice Date, Technical Support" in prompt
        assert '"fees": "$1,000 a month"' in prompt
        assert "Today: Wednesday: 2026-10-28" in prompt
        assert "- Monday: 2026-11-02" in prompt

    def test_inactive_fields_are_left_out_of_the_prompt(self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch) -> None:
        fake = use(monkeypatch, FakeLlm(turn("mutual-nda")))
        assistant.respond(HISTORY, "mutual-nda", NDA.default_values(TODAY) | {"mndaTerm": "untilTerminated"}, TODAY)
        assert "- mndaTermYears:" not in fake.system_prompt(0)
        assert "- confidentialityYears:" in fake.system_prompt(0)

    def test_llm_errors_propagate(self, assistant: Assistant, monkeypatch: pytest.MonkeyPatch) -> None:
        use(monkeypatch, FakeLlm(llm.LlmError("timeout")))
        with pytest.raises(llm.LlmError):
            assistant.respond(HISTORY, "mutual-nda", NDA.default_values(TODAY), TODAY)


class TestApplyUpdates:
    def answer(self, spec_id: str, **changes: Any) -> BaseModel:
        model = Assistant(CATALOG).turn_models[spec_id]
        return model.model_validate(turn(spec_id, **changes)).updates  # type: ignore[attr-defined]

    def test_no_updates_change_nothing(self) -> None:
        values = NDA.default_values(TODAY)
        assert apply_updates(NDA, values, self.answer("mutual-nda")) == values

    def test_merges_party_fields_without_clearing_the_others(self) -> None:
        values = NDA.default_values(TODAY) | {"party2.company": "Globex LLC"}
        result = apply_updates(NDA, values, self.answer("mutual-nda", party2={"title": "CFO"}))
        assert result["party2.title"] == "CFO"
        assert result["party2.company"] == "Globex LLC"

    @pytest.mark.parametrize(
        "changes",
        [
            {"effectiveDate": "2026-11-03T00:00:00"},
            {"effectiveDate": "next Monday"},
            {"mndaTermYears": 0},
            {"governingLaw": "  "},
            {"party1": {"company": ""}},
        ],
    )
    def test_drops_invalid_values(self, changes: dict[str, Any]) -> None:
        values = NDA.default_values(TODAY) | {"governingLaw": "Delaware", "party1.company": "Acme Inc."}
        result = apply_updates(NDA, values, self.answer("mutual-nda", jurisdiction="Wilmington, DE", **changes))
        assert result == values | {"jurisdiction": "Wilmington, DE"}

    def test_an_empty_string_clears_an_optional_field(self) -> None:
        values = NDA.default_values(TODAY) | {"modifications": "Section 3 is deleted."}
        assert apply_updates(NDA, values, self.answer("mutual-nda", modifications=""))["modifications"] == ""

    def test_shortens_values_that_are_too_long(self) -> None:
        result = apply_updates(NDA, NDA.default_values(TODAY), self.answer("mutual-nda", purpose="x" * 6000))
        assert len(result["purpose"]) == 5000


def test_schemas_require_every_field_and_describe_it() -> None:
    schema = Assistant(CATALOG).turn_models["mutual-nda"].model_json_schema()
    updates = schema["$defs"]["MutualNdaUpdates"]
    assert updates["required"] == list(updates["properties"])
    assert updates["properties"]["mndaTerm"]["anyOf"][0]["enum"] == ["expires", "untilTerminated"]
    assert "YYYY-MM-DD" in updates["properties"]["effectiveDate"]["description"]
    assert set(schema["required"]) == {"reply", "question", "updates", "switchTo"}
