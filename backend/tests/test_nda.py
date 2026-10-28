from datetime import date

import pytest
from nda_samples import DEFAULT_FIELDS as DEFAULT_FIELDS_JSON
from pydantic import ValidationError

from app.nda import (
    MAX_MESSAGE_LENGTH,
    ChatTurn,
    NdaFields,
    NdaUpdates,
    Party,
    PartyUpdate,
    apply_updates,
    build_messages,
    missing_fields,
)

DEFAULT_FIELDS = NdaFields.model_validate(DEFAULT_FIELDS_JSON)

PARTY = {"name": "Jane Doe", "title": "CEO", "company": "Acme Inc.", "noticeAddress": "jane@acme.com"}

COMPLETE_FIELDS = DEFAULT_FIELDS.model_copy(
    update={
        "governing_law": "Delaware",
        "jurisdiction": "courts located in New Castle, DE",
        "party1": Party.model_validate(PARTY),
        "party2": Party.model_validate({**PARTY, "company": "Globex LLC"}),
    }
)


def party_update(**changes: str) -> PartyUpdate:
    """A PartyUpdate with every field null except `changes`."""
    return PartyUpdate.model_validate({name: None for name in PartyUpdate.model_fields} | changes)


def no_updates(**changes: object) -> NdaUpdates:
    """An NdaUpdates with every field null except `changes`."""
    nulls = {name: None for name in NdaUpdates.model_fields}
    return NdaUpdates.model_validate(nulls | {"party1": party_update(), "party2": party_update()} | changes)


class TestApplyUpdates:
    def test_no_updates_change_nothing(self) -> None:
        assert apply_updates(COMPLETE_FIELDS, no_updates()) == COMPLETE_FIELDS

    def test_sets_only_the_given_fields(self) -> None:
        updated = apply_updates(
            DEFAULT_FIELDS, no_updates(governing_law="California", mnda_term="untilTerminated")
        )
        assert updated == DEFAULT_FIELDS.model_copy(
            update={"governing_law": "California", "mnda_term": "untilTerminated"}
        )

    def test_merges_party_fields_without_clearing_the_others(self) -> None:
        updated = apply_updates(COMPLETE_FIELDS, no_updates(party2=party_update(title="CFO")))
        assert updated.party2.title == "CFO"
        assert updated.party2.company == "Globex LLC"
        assert updated.party1 == COMPLETE_FIELDS.party1

    def test_an_empty_string_clears_a_field(self) -> None:
        with_modifications = COMPLETE_FIELDS.model_copy(update={"modifications": "Section 3 is deleted."})
        assert apply_updates(with_modifications, no_updates(modifications="")).modifications == ""

    def test_does_not_modify_its_input(self) -> None:
        apply_updates(DEFAULT_FIELDS, no_updates(party1=party_update(name="Jane Doe")))
        assert DEFAULT_FIELDS.party1.name == ""

    @pytest.mark.parametrize(
        "changes",
        [
            {"effective_date": "2026-11-03T00:00:00"},
            {"effective_date": "next Monday"},
            {"mnda_term_years": 0},
            {"confidentiality_years": -2},
            {"purpose": "x" * 5001},
            {"party2": party_update(company="x" * 501)},
        ],
    )
    def test_drops_values_the_fields_would_reject(self, changes: dict[str, object]) -> None:
        updated = apply_updates(COMPLETE_FIELDS, no_updates(governing_law="California", **changes))
        # The valid value in the same turn is still applied.
        assert updated == COMPLETE_FIELDS.model_copy(update={"governing_law": "California"})
        # Whatever is returned can be sent back with the next message.
        NdaFields.model_validate(updated.model_dump(by_alias=True))


class TestChatTurn:
    def test_trims_the_reply(self) -> None:
        turn = ChatTurn.model_validate({"reply": "  Hello!\n", "updates": no_updates()})
        assert turn.reply == "Hello!"

    @pytest.mark.parametrize("reply", ["", " \n "])
    def test_rejects_a_blank_reply(self, reply: str) -> None:
        with pytest.raises(ValidationError):
            ChatTurn.model_validate({"reply": reply, "updates": no_updates()})

    def test_shortens_a_reply_too_long_to_send_back(self) -> None:
        turn = ChatTurn.model_validate({"reply": "x" * (MAX_MESSAGE_LENGTH + 1), "updates": no_updates()})
        assert len(turn.reply) == MAX_MESSAGE_LENGTH


class TestMissingFields:
    def test_lists_every_required_field_of_an_empty_nda(self) -> None:
        empty = DEFAULT_FIELDS.model_copy(update={"purpose": " ", "effective_date": ""})
        assert missing_fields(empty) == [
            "Purpose",
            "Effective date",
            "Governing law",
            "Jurisdiction",
            "Party 1 name",
            "Party 1 title",
            "Party 1 company",
            "Party 1 notice address",
            "Party 2 name",
            "Party 2 title",
            "Party 2 company",
            "Party 2 notice address",
        ]

    def test_accepts_a_complete_nda(self) -> None:
        assert missing_fields(COMPLETE_FIELDS) == []

    @pytest.mark.parametrize("effective_date", ["2026-02-30", "20261-10-27", "0999-01-01", "20261027"])
    def test_rejects_invalid_dates(self, effective_date: str) -> None:
        fields = COMPLETE_FIELDS.model_copy(update={"effective_date": effective_date})
        assert missing_fields(fields) == ["Effective date"]

    def test_checks_years_only_for_the_selected_options(self) -> None:
        invalid_years = COMPLETE_FIELDS.model_copy(
            update={"mnda_term_years": None, "confidentiality_years": 1.5}
        )
        assert missing_fields(invalid_years) == ["MNDA term (years)", "Term of confidentiality (years)"]
        unused_years = invalid_years.model_copy(
            update={"mnda_term": "untilTerminated", "confidentiality_term": "perpetual"}
        )
        assert missing_fields(unused_years) == []


class TestBuildMessages:
    def test_puts_instructions_and_state_before_the_history(self) -> None:
        history = [
            {"role": "assistant", "content": "Who are the parties?"},
            {"role": "user", "content": "Acme and Globex"},
        ]
        system, *rest = build_messages(history, DEFAULT_FIELDS, date(2026, 10, 28))

        assert rest == history
        assert system["role"] == "system"
        assert "Today: Wednesday: 2026-10-28" in system["content"]
        assert "- Monday: 2026-11-02" in system["content"]
        # The field values are shown with the same names as in the schema.
        assert '"mndaTermYears": 1' in system["content"]
        assert "Still missing: Governing law, Jurisdiction, Party 1 name" in system["content"]

    def test_says_when_nothing_is_missing(self) -> None:
        [system] = build_messages([], COMPLETE_FIELDS, date(2026, 10, 28))
        assert "Still missing: nothing, the NDA is complete" in system["content"]


def test_llm_schema_uses_camel_case_with_every_field_required() -> None:
    schema = ChatTurn.model_json_schema()
    updates = schema["$defs"]["NdaUpdates"]
    assert "mndaTermYears" in updates["properties"]
    assert updates["required"] == list(updates["properties"])
    assert all("description" in prop for prop in updates["properties"].values())
