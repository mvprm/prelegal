from datetime import date

import pytest

from app.config import Settings
from app.documents import Catalog, DocumentSpec, FieldSpec, InvalidDraftError

CATALOG = Catalog.load(Settings().documents_path)
TEMPLATES_DIR = Settings().documents_path.parent / "templates"
TODAY = date(2026, 10, 28)


def field(**overrides: object) -> FieldSpec:
    return FieldSpec.model_validate({"id": "x", "label": "X", "type": "text", "required": True, "description": ""} | overrides)


class TestDocumentsJson:
    def test_lists_all_eleven_documents(self) -> None:
        assert len(CATALOG.documents) == 11

    @pytest.mark.parametrize("spec", CATALOG.documents.values(), ids=lambda spec: spec.id)
    def test_document_is_consistent(self, spec: DocumentSpec) -> None:
        assert (TEMPLATES_DIR / spec.standard_terms).is_file()
        if spec.cover_page_template:
            assert (TEMPLATES_DIR / spec.cover_page_template).is_file()
        assert len(spec.all_fields) == len(spec.fields) + 8, "field ids must be unique"
        for f in spec.fields:
            if f.type == "choice":
                assert f.options, f.id
            if f.default is not None:
                assert f.default == "today" if f.type == "date" else f.is_valid(f.default), f.id
            if f.when is not None:
                condition = spec.all_fields[f.when.field]
                assert any(option.value == f.when.equals for option in condition.options), f.id

    def test_unknown_ids_find_nothing(self) -> None:
        assert CATALOG.get(None) is None
        assert CATALOG.get("employment-contract") is None
        with pytest.raises(InvalidDraftError, match="Unknown document 'employment-contract'"):
            CATALOG.require("employment-contract")


class TestFieldSpec:
    @pytest.mark.parametrize(
        ("spec", "valid", "invalid"),
        [
            (field(type="text"), ["Delaware"], ["", "  "]),
            (field(type="date"), ["2026-10-28"], ["", "2026-02-30", "0999-01-01", "20261028", "next Monday"]),
            (field(type="years"), ["1", "12"], ["", "0", "-1", "1.5", "two"]),
            (field(type="choice", options=[{"value": "a", "label": "A"}]), ["a"], ["", "b"]),
        ],
    )
    def test_validates_by_type(self, spec: FieldSpec, valid: list[str], invalid: list[str]) -> None:
        assert all(spec.is_valid(value) for value in valid)
        assert not any(spec.is_valid(value) for value in invalid)

    def test_accept_returns_the_value_to_store_or_none(self) -> None:
        required, optional = field(), field(required=False)
        assert required.accept("  Delaware ") == "Delaware"
        assert required.accept(" ") is None
        assert optional.accept(" ") == ""
        assert field(type="date").accept("next Monday") is None
        assert required.accept("x" * 6000) == "x" * 5000

    def test_conditional_fields_apply_only_when_their_condition_holds(self) -> None:
        years = field(when={"field": "term", "equals": "expires"})
        assert years.is_active({"term": "expires"})
        assert not years.is_active({"term": "untilTerminated"})


class TestDocumentSpec:
    def test_adds_a_signature_block_for_each_party(self) -> None:
        csa = CATALOG.documents["cloud-service-agreement"]
        party_fields = {f.id: f.label for f in csa.party_fields}
        assert party_fields["party1.company"] == "Provider company"
        assert party_fields["party2.noticeAddress"] == "Customer notice address"
        assert all(f.required for f in csa.party_fields)

    def test_default_values_fill_in_defaults_and_today(self) -> None:
        values = CATALOG.documents["mutual-nda"].default_values(TODAY)
        assert values["effectiveDate"] == "2026-10-28"
        assert values["mndaTerm"] == "expires"
        assert values["mndaTermYears"] == "1"
        assert values["governingLaw"] == ""
        assert values["party1.company"] == ""

    def test_complete_values_adds_left_out_fields_and_rejects_unknown_ones(self) -> None:
        nda = CATALOG.documents["mutual-nda"]
        values = nda.complete_values({"governingLaw": "Texas"})
        assert set(values) == set(nda.all_fields)
        assert values["governingLaw"] == "Texas"
        assert values["purpose"] == ""
        with pytest.raises(InvalidDraftError, match="Unknown fields: salary"):
            nda.complete_values({"salary": "1"})

    def test_missing_fields_of_a_new_nda(self) -> None:
        nda = CATALOG.documents["mutual-nda"]
        assert nda.missing_fields(nda.default_values(TODAY)) == [
            "Governing Law",
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

    def test_missing_fields_ignore_optional_and_inactive_fields(self) -> None:
        nda = CATALOG.documents["mutual-nda"]
        values = nda.default_values(TODAY) | {f.id: "x" for f in nda.party_fields} | {
            "governingLaw": "Delaware",
            "jurisdiction": "courts located in New Castle, DE",
            "modifications": "",
            "mndaTerm": "untilTerminated",
            "mndaTermYears": "",
        }
        assert nda.missing_fields(values) == []
        assert nda.missing_fields(values | {"mndaTerm": "expires"}) == ["MNDA Term (years)"]
