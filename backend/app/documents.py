"""The supported documents and their fields, from documents.json in the repository root.

The frontend reads the same file (frontend/src/lib/documents/catalog.ts) and applies the
same rules for defaults, validity and missing fields, so a change here usually needs the
same change there.
"""

import re
from datetime import date
from functools import cached_property
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, TypeAdapter
from pydantic.alias_generators import to_camel

Values = dict[str, str]
"""Every value is a string, as typed into the form; empty means not filled in."""

MAX_VALUE_LENGTH = 5000
"""The longest field value (`MAX_VALUE_LENGTH` in chat.ts)."""

PARTY_KEYS = ("party1", "party2")
"""The prefixes of the two parties' field ids, e.g. "party1.company"."""


class InvalidDraftError(ValueError):
    """The browser sent a document or fields that the catalog does not have."""


class CamelModel(BaseModel):
    """Snake case in Python, camelCase in JSON, matching the frontend."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class Option(CamelModel):
    value: str
    label: str


class Condition(CamelModel):
    field: str
    equals: str


class FieldSpec(CamelModel):
    id: str
    """Key in the values, e.g. "governingLaw" or "party1.company"."""
    label: str
    type: Literal["text", "longtext", "date", "choice", "years"]
    required: bool
    default: str | None = None
    """Pre-filled value. For dates, "today" means the user's local date."""
    description: str
    options: tuple[Option, ...] = ()
    when: Condition | None = None
    """The field only applies while another field has the given value."""

    def is_active(self, values: Values) -> bool:
        return self.when is None or values.get(self.when.field) == self.when.equals

    def is_valid(self, value: str) -> bool:
        """Whether `value` is complete and well-formed for this field. Empty is never valid."""
        match self.type:
            case "date":
                return is_iso_date(value)
            case "years":
                return re.fullmatch(r"[1-9]\d*", value.strip()) is not None
            case "choice":
                return any(option.value == value for option in self.options)
            case _:
                return value.strip() != ""

    def accept(self, value: str) -> str | None:
        """`value` as it would be stored, or None if it cannot be: valid, or empty for an
        optional field (which clears it), and cut to `MAX_VALUE_LENGTH`."""
        text = value.strip()
        if self.is_valid(text) or (text == "" and not self.required):
            return text[:MAX_VALUE_LENGTH]
        return None


# The signature block filled in for each party: (key, label after the role, description).
PARTY_PARTS = (
    ("name", "name", "Full name of the person signing"),
    ("title", "title", "The signer's job title"),
    ("company", "company", "The party's legal company name"),
    ("noticeAddress", "notice address", "Email or postal address for legal notices"),
)


class DocumentSpec(CamelModel):
    id: str
    name: str
    description: str
    standard_terms: str
    cover_page_template: str | None = None
    parties: tuple[str, str]
    """The two parties' roles, e.g. ("Provider", "Customer")."""
    fields: tuple[FieldSpec, ...]

    @cached_property
    def party_fields(self) -> tuple[FieldSpec, ...]:
        """e.g. "party1.company", labelled "Provider company"."""
        return tuple(
            FieldSpec(
                id=f"{prefix}.{key}",
                label=f"{role} {label}",
                type="longtext" if key == "noticeAddress" else "text",
                required=True,
                description=description,
            )
            for prefix, role in zip(PARTY_KEYS, self.parties, strict=True)
            for key, label, description in PARTY_PARTS
        )

    @cached_property
    def all_fields(self) -> dict[str, FieldSpec]:
        """The document's own fields followed by both parties' fields, by id."""
        return {field.id: field for field in (*self.fields, *self.party_fields)}

    def default_values(self, today: date) -> Values:
        """A new document's values: defaults filled in, everything else empty."""
        return {
            field.id: today.isoformat() if field.default == "today" else (field.default or "")
            for field in self.all_fields.values()
        }

    def complete_values(self, values: Values) -> Values:
        """`values` with a key for every field, empty where the browser left one out.
        Raises `InvalidDraftError` for keys the document does not have."""
        unknown = values.keys() - self.all_fields.keys()
        if unknown:
            raise InvalidDraftError(f"Unknown fields: {', '.join(sorted(unknown))}")
        return {field_id: values.get(field_id, "") for field_id in self.all_fields}

    def missing_fields(self, values: Values) -> list[str]:
        """Labels of the required fields that are still empty or invalid."""
        return [
            field.label
            for field in self.all_fields.values()
            if field.required and field.is_active(values) and not field.is_valid(values.get(field.id, ""))
        ]


class Catalog:
    """All supported documents, by id."""

    def __init__(self, documents: list[DocumentSpec]) -> None:
        self.documents = {document.id: document for document in documents}

    @classmethod
    def load(cls, path: Path) -> "Catalog":
        return cls(TypeAdapter(list[DocumentSpec]).validate_json(path.read_bytes()))

    def get(self, document_id: str | None) -> DocumentSpec | None:
        return self.documents.get(document_id) if document_id else None

    def require(self, document_id: str) -> DocumentSpec:
        """The document, or `InvalidDraftError` if there is no such document."""
        spec = self.get(document_id)
        if spec is None:
            raise InvalidDraftError(f"Unknown document {document_id!r}")
        return spec


def is_iso_date(value: str) -> bool:
    """YYYY-MM-DD for a real date in the years 1000 to 9999, like `formatDate()` on the frontend."""
    if not re.fullmatch(r"[1-9]\d{3}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True
