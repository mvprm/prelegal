"""The Mutual NDA's fields and the AI chat that fills them in.

The field models mirror `NdaFields` in frontend/src/lib/nda/fields.ts, with the same
camelCase names on the wire.
"""

import json
import logging
import math
import re
from collections.abc import Callable
from datetime import date, timedelta
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, ValidationError
from pydantic.alias_generators import to_camel

log = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 4000
"""The longest chat message, from the user or the assistant (`MAX_MESSAGE_LENGTH` in chat.ts)."""


class CamelModel(BaseModel):
    """Snake case in Python, camelCase in JSON, matching the frontend."""

    # validate_assignment lets apply_updates() check each value the LLM sets.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, validate_assignment=True)


ShortText = Annotated[str, Field(max_length=500)]
LongText = Annotated[str, Field(max_length=5000)]

# The form's years inputs can hold a fraction, or nothing while the user is typing.
# The frontend sends those as they are and flags them as invalid, so they are accepted here.
# Infinity and NaN, which only a hand-made request can send, count as nothing: they could
# not be written back out as JSON, not even in a validation error.
Years = Annotated[
    int | float | None, AfterValidator(lambda years: years if years is None or math.isfinite(years) else None)
]


class Party(CamelModel):
    name: ShortText
    title: ShortText
    company: ShortText
    notice_address: ShortText


class NdaFields(CamelModel):
    purpose: LongText
    effective_date: str = Field(max_length=10)
    """ISO date (YYYY-MM-DD), or empty."""
    mnda_term: Literal["expires", "untilTerminated"]
    mnda_term_years: Years
    confidentiality_term: Literal["years", "perpetual"]
    confidentiality_years: Years
    governing_law: ShortText
    jurisdiction: ShortText
    modifications: LongText
    party1: Party
    party2: Party


# The models below are the LLM's Structured Outputs schema. Every field is required but
# nullable, as strict schemas need, and null means "the user did not change this".
# The descriptions are part of the schema, so they double as instructions for the model.


class PartyUpdate(CamelModel):
    name: str | None = Field(description="Full name of the person signing for this party")
    title: str | None = Field(description="The signer's job title, e.g. CEO")
    company: str | None = Field(description="The party's legal company name, e.g. Acme Inc.")
    notice_address: str | None = Field(
        description="Email or postal address where this party receives legal notices"
    )


class NdaUpdates(CamelModel):
    purpose: str | None = Field(
        description="How the parties may use each other's Confidential Information, as a sentence"
    )
    effective_date: str | None = Field(description="The date the MNDA starts, as YYYY-MM-DD")
    mnda_term: Literal["expires", "untilTerminated"] | None = Field(
        description='"expires" if the MNDA ends a number of years after the Effective Date, '
        '"untilTerminated" if it continues until either party terminates it'
    )
    mnda_term_years: int | None = Field(
        description='Whole number of years (at least 1) until the MNDA expires, when mndaTerm is "expires"'
    )
    confidentiality_term: Literal["years", "perpetual"] | None = Field(
        description='"years" if Confidential Information is protected for a number of years after '
        'the Effective Date, "perpetual" if it is protected forever'
    )
    confidentiality_years: int | None = Field(
        description='Whole number of years (at least 1) Confidential Information is protected, '
        'when confidentialityTerm is "years"'
    )
    governing_law: str | None = Field(
        description='Only the name of the US state whose laws govern the MNDA, e.g. "Delaware"'
    )
    jurisdiction: str | None = Field(
        description='The courts that hear disputes, e.g. "courts located in New Castle, DE"'
    )
    modifications: str | None = Field(
        description='Changes to the Standard Terms; an empty string if the user wants none'
    )
    # Never null themselves: given that option, the model tends to drop a whole party
    # when it only knows some of its fields.
    party1: PartyUpdate = Field(description="The first party, usually the user's company")
    party2: PartyUpdate = Field(description="The other party")


def _chat_message(text: str) -> str:
    """Rejects a blank reply, and shortens a long one so the browser can send it back as history."""
    text = text.strip()
    if not text:
        raise ValueError("the reply is empty")
    return text[:MAX_MESSAGE_LENGTH]


class ChatTurn(CamelModel):
    """The LLM's answer to one user message."""

    # An AfterValidator, unlike Field(min_length=...), stays out of the schema sent to the LLM.
    reply: Annotated[str, AfterValidator(_chat_message)] = Field(
        description="Your next chat message to the user, in plain text"
    )
    updates: NdaUpdates = Field(
        description="Values the user gave or changed in their latest message; null for everything else"
    )


def apply_updates(fields: NdaFields, updates: NdaUpdates) -> NdaFields:
    """Returns `fields` with every non-null value from `updates` filled in.

    Invalid values, such as a date that is not YYYY-MM-DD or text that is too long, are
    dropped. The browser sends the fields back with its next message, so storing one would
    make every later request fail validation.
    """
    result = fields.model_copy(deep=True)
    changes = updates.model_dump(exclude_none=True)
    for key in ("party1", "party2"):
        for name, value in changes.pop(key).items():
            _assign(getattr(result, key), name, value)
    for name, value in changes.items():
        _assign(result, name, value)
    return result


def _assign(model: CamelModel, name: str, value: Any) -> None:
    """Sets `model.name` to `value` if it is valid; otherwise leaves the field as it was."""
    check = _UPDATE_CHECKS.get(name)
    if check and not check(value):
        log.warning("Ignored an invalid %s from the LLM: %r", name, value)
        return
    try:
        setattr(model, name, value)  # Validated against the field's constraints.
    except ValidationError:
        log.warning("Ignored an invalid %s from the LLM: %r", name, value)


# Field labels for missing_fields(), keyed by Party's attribute names.
_PARTY_LABELS = {"name": "name", "title": "title", "company": "company", "notice_address": "notice address"}


def missing_fields(fields: NdaFields) -> list[str]:
    """The required fields that are still empty or invalid, as in `missingFields()` on the frontend."""
    missing = []
    if not fields.purpose.strip():
        missing.append("Purpose")
    if not _is_iso_date(fields.effective_date):
        missing.append("Effective date")
    if fields.mnda_term == "expires" and not _is_valid_years(fields.mnda_term_years):
        missing.append("MNDA term (years)")
    if fields.confidentiality_term == "years" and not _is_valid_years(fields.confidentiality_years):
        missing.append("Term of confidentiality (years)")
    if not fields.governing_law.strip():
        missing.append("Governing law")
    if not fields.jurisdiction.strip():
        missing.append("Jurisdiction")
    for number, party in ((1, fields.party1), (2, fields.party2)):
        for name, label in _PARTY_LABELS.items():
            if not getattr(party, name).strip():
                missing.append(f"Party {number} {label}")
    return missing


def _is_iso_date(value: str) -> bool:
    """YYYY-MM-DD for a real date in the years 1000 to 9999, like `formatDate()` on the frontend."""
    if not re.fullmatch(r"[1-9]\d{3}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def _is_valid_years(years: Years) -> bool:
    return years is not None and years == int(years) and years >= 1


# Values the form accepts while the user is typing, but the LLM must get right.
_UPDATE_CHECKS: dict[str, Callable[[Any], bool]] = {
    "effective_date": _is_iso_date,
    "mnda_term_years": _is_valid_years,
    "confidentiality_years": _is_valid_years,
}


SYSTEM_PROMPT = """\
You are the assistant in Prelegal, an app for drafting legal agreements. You are helping \
the user fill in the Cover Page of a Common Paper Mutual Non-Disclosure Agreement (MNDA). \
The Cover Page sets the variables of the MNDA; the Standard Terms are fixed and \
incorporated by reference.

How to run the conversation:
- Ask about one topic at a time, with at most two short questions per message. Good order: \
the two parties (company, signer name and title, notice address), the purpose, the \
effective date, the MNDA term, the term of confidentiality, governing law and \
jurisdiction, then any modifications.
- Purpose, effective date and both terms already hold default values. Mention the \
defaults and ask the user to confirm or change them, rather than asking from scratch.
- The user can also edit the fields in a form next to this chat, so the current values \
below are always the latest ones. Do not ask again for values that are already filled in, \
unless the user wants to change them.
- If the user asks what a field means, explain it briefly in plain language. You can \
describe common choices, but do not give legal advice.
- Keep replies short and friendly, in plain text without Markdown.
- When nothing is missing, give a one-line summary and tell the user they can download \
the PDF with the "Download PDF" button, or keep making changes.

How to fill in `updates`:
- Capture every value the user gave or confirmed in their latest message, including \
corrections and values you did not ask about, for both parties. If your reply mentions a \
value as recorded, it must be in `updates`.
- Leave every other field null. Never invent values.
- Write values the way they read on a legal document: full company names, proper \
capitalization, dates as YYYY-MM-DD. Resolve relative dates like "next Monday" with \
the calendar below; do not work out weekdays yourself.
- Party 1 is usually the user's own company and Party 2 the other side.

Today: {today}
The next two weeks:
{calendar}

Current field values (JSON):
{fields}

Still missing: {missing}
"""


def build_messages(
    history: list[dict[str, str]], fields: NdaFields, today: date
) -> list[dict[str, str]]:
    """The full prompt: instructions with the current state of the NDA, then the chat so far."""
    missing = missing_fields(fields)
    system = SYSTEM_PROMPT.format(
        today=_day(today),
        # The model is unreliable at date arithmetic, so it gets the days spelled out.
        calendar="\n".join(f"- {_day(today + timedelta(days=n))}" for n in range(1, 15)),
        fields=json.dumps(fields.model_dump(by_alias=True), indent=2),
        missing=", ".join(missing) if missing else "nothing, the NDA is complete",
    )
    return [{"role": "system", "content": system}, *history]


def _day(day: date) -> str:
    """e.g. "Wednesday: 2026-10-28"."""
    return f"{day:%A}: {day.isoformat()}"
