"""The AI assistant that picks a document from the conversation and fills in its fields.

Each turn the LLM answers with Structured Outputs. Until a document is chosen, the schema
lets it pick one (`SelectionTurn`); after that, it is built from the document's fields
(`DocumentTurn`), so the model can only set fields the document has.
"""

import json
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal

from pydantic import BaseModel, Field, create_model

from . import llm
from .documents import PARTY_KEYS, PARTY_PARTS, Catalog, DocumentSpec, FieldSpec, Values

log = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 4000
"""The longest chat message, from the user or the assistant (`MAX_MESSAGE_LENGTH` in chat.ts)."""

Message = dict[str, str]


@dataclass(frozen=True)
class ChatResult:
    reply: str
    document_id: str | None
    values: Values


class Turn(BaseModel):
    """What every LLM answer has. The fields' descriptions are part of the schema, so they
    double as instructions for the model."""

    reply: str = Field(description="Your answer to the user's latest message, in plain text. May be empty.")
    question: str = Field(
        description="The question you ask the user next, in plain text, phrased as a question that "
        'ends with "?" (not an instruction such as "Please provide..."). Always ask one: about the '
        "next missing information, or, when nothing is missing, whether they want any changes."
    )


class SelectionTurn(Turn):
    """An answer before a document is chosen; `Assistant` narrows `document_id` to the catalog's ids."""

    document_id: str | None


class DocumentTurn(Turn):
    """An answer while drafting; `_turn_model` narrows both fields to the document."""

    updates: BaseModel
    switch_to: str | None


class Assistant:
    """Answers chat messages for one catalog of documents."""

    def __init__(self, catalog: Catalog) -> None:
        self.catalog = catalog
        ids = tuple(catalog.documents)
        self.selection_model = create_model(
            "SelectionTurn",
            __base__=SelectionTurn,
            document_id=(
                Literal[ids] | None,  # type: ignore[valid-type]
                Field(
                    alias="documentId",
                    description="The id of the document the user wants, once they have chosen a "
                    "supported one; null until then",
                ),
            ),
        )
        self.turn_models = {spec.id: _turn_model(spec, ids) for spec in catalog.documents.values()}

    def respond(self, history: list[Message], document_id: str | None, values: Values, today: date) -> ChatResult:
        """Answers the latest message in `history`, choosing or switching the document if asked.

        Raises `InvalidDraftError` if `document_id` or the keys of `values` are unknown.
        """
        spec = self.catalog.require(document_id) if document_id is not None else None
        if spec is None:
            pick = llm.structured_completion(_selection_messages(self.catalog, history), self.selection_model)
            spec = self.catalog.get(pick.document_id)
            if spec is None:
                return ChatResult(_message(pick.reply, pick.question, "What would you like to draft?"), None, {})
            values = spec.default_values(today)
        else:
            values = spec.complete_values(values)

        # A draft with nothing but its defaults counts as just chosen, whether the AI chose it
        # above or the user picked a card in the browser: details from the conversation so far
        # are still to be captured. It stays so until something is filled in.
        just_chosen = values == spec.default_values(today)
        turn = self._document_turn(spec, history, values, today, just_chosen)
        switch = self.catalog.get(turn.switch_to)
        if switch is not None and switch.id != spec.id:
            # The user asked for a different document: start it afresh, taking what applies
            # from the whole conversation.
            spec, values = switch, switch.default_values(today)
            turn = self._document_turn(spec, history, values, today, just_chosen=True)

        values = apply_updates(spec, values, turn.updates)
        return ChatResult(_message(turn.reply, turn.question, _next_question(spec, values)), spec.id, values)

    def _document_turn(
        self, spec: DocumentSpec, history: list[Message], values: Values, today: date, just_chosen: bool
    ) -> DocumentTurn:
        messages = _document_messages(self.catalog, spec, history, values, today, just_chosen)
        return llm.structured_completion(messages, self.turn_models[spec.id])


def _message(reply: str, question: str, fallback_question: str) -> str:
    """The reply followed by the question, so every message asks the user something. A
    question that does not actually ask anything (no "?") gets `fallback_question` added."""
    parts = [reply.strip(), question.strip()]
    if "?" not in parts[1]:
        parts.append(fallback_question)
    return "\n\n".join(part for part in parts if part)[:MAX_MESSAGE_LENGTH]


def _next_question(spec: DocumentSpec, values: Values) -> str:
    """A question to fall back on: about the first missing field, or whether the user is done."""
    missing = spec.missing_fields(values)
    if missing:
        return f"What should the {missing[0]} be?"
    return "Would you like to change anything, or are you ready to download the PDF?"


def _turn_model(spec: DocumentSpec, ids: tuple[str, ...]) -> type[DocumentTurn]:
    """The schema of the LLM's answer while drafting `spec`. Every field is required but
    nullable, as strict schemas need; null means "the user did not change this"."""
    party_model = create_model(
        f"{_model_name(spec)}Party",
        **{key: (str | None, Field(description=description)) for key, _, description in PARTY_PARTS},
    )
    updates = create_model(
        f"{_model_name(spec)}Updates",
        **{field.id: (_update_type(field), Field(description=_describe(field))) for field in spec.fields},
        # Never null themselves: given that option, the model tends to drop a whole party
        # when it only knows some of its fields.
        **{
            key: (party_model, Field(description=f"The {role}"))
            for key, role in zip(PARTY_KEYS, spec.parties, strict=True)
        },
    )
    return create_model(
        f"{_model_name(spec)}Turn",
        __base__=DocumentTurn,
        updates=(updates, Field(description="Values the user gave or changed; null for everything else")),
        switch_to=(
            Literal[ids] | None,  # type: ignore[valid-type]
            Field(
                alias="switchTo",
                description="The id of a different supported document, only if the user wants "
                "to draft that instead; otherwise null",
            ),
        ),
    )


def _model_name(spec: DocumentSpec) -> str:
    return "".join(word.capitalize() for word in spec.id.split("-"))


def _update_type(field: FieldSpec) -> Any:
    if field.type == "choice":
        return Literal[tuple(option.value for option in field.options)] | None  # type: ignore[valid-type]
    if field.type == "years":
        return int | None
    return str | None


def _describe(field: FieldSpec) -> str:
    """The field's description for the LLM, with the format its value must have."""
    formats = {
        "date": " (a date, YYYY-MM-DD)",
        "years": " (a whole number of years, at least 1)",
        "choice": " (one of: " + "; ".join(f'"{o.value}" = {o.label}' for o in field.options) + ")",
    }
    return f"{field.label}: {field.description}{formats.get(field.type, '')}"


def apply_updates(spec: DocumentSpec, values: Values, updates: BaseModel) -> Values:
    """Returns `values` with every acceptable non-null value from `updates` filled in.

    Other values, such as a date that is not YYYY-MM-DD, are dropped rather than stored:
    the browser sends the values back with its next message, which would then be rejected.
    """
    changes = updates.model_dump(exclude_none=True)
    for key in PARTY_KEYS:
        changes |= {f"{key}.{name}": value for name, value in changes.pop(key).items()}

    result = dict(values)
    for field_id, value in changes.items():
        text = spec.all_fields[field_id].accept(str(value))
        if text is None:
            log.warning("Ignored an invalid %s from the LLM: %r", field_id, value)
        else:
            result[field_id] = text
    return result


SELECTION_PROMPT = """\
You are the assistant in Prelegal, an app for drafting legal agreements from Common Paper's \
standard templates. The user has not chosen a document yet. These are the only documents \
Prelegal can draft (id: name, what it is for):

{documents}

How to help:
- Find out what the user needs. If a supported document clearly fits their request, choose \
it straight away by setting documentId. If several could fit, briefly explain the \
difference and ask which they want.
- If they ask for something Prelegal cannot draft (for example an employment contract, a \
lease or a one-way NDA), say plainly that Prelegal cannot generate that document. Then offer \
the closest supported document, if one is reasonably close, explaining in a sentence what it \
covers and how it differs from what they asked for. Set documentId only once they agree.
- Never write agreement text yourself, and do not give legal advice.
- Keep replies short and friendly, in plain text without Markdown.
- Always end with a question in `question`, e.g. which document they want or whether the \
suggested one works for them.
"""

DOCUMENT_PROMPT = """\
You are the assistant in Prelegal, an app for drafting legal agreements from Common Paper's \
standard templates. You are helping the user fill in the Cover Page of a {name}: {description} \
The Standard Terms are fixed and incorporated by reference; only the fields below can be set.

{progress}

How to run the conversation:
- Ask about one topic at a time, with at most two short questions per message. Start with the \
parties (the {role1} and the {role2}: company, signer name and title, notice address), then the \
required fields in the order listed, then offer the optional ones.
- Fields with a value are already filled in, some with defaults; mention defaults and let the \
user confirm or change them rather than asking from scratch.
- Optional fields: mention them briefly, suggest common choices, and accept "none" or "skip". \
You can offer several optional fields in one question.
- The user can also edit the fields in a form next to this chat, so the current values below \
are always the latest ones. Do not ask again for values that are filled in, unless the user \
wants to change them.
- If the user asks what a field means, explain it briefly in plain language. You can describe \
common choices, but do not give legal advice.
- If the user wants a different document that Prelegal supports, set `switchTo` to its id. If \
they want one Prelegal cannot draft, say so and offer the closest supported document. \
Supported documents: {documents}.
- Keep replies short and friendly, in plain text without Markdown.
- `question` must always ask the user something: the next missing information, or, when \
nothing required is missing, whether they want to fill in optional fields, change anything, \
or download the PDF with the "Download PDF" button.

How to fill in `updates`:
- {capture}
- If your reply mentions a value as recorded, it must be in `updates`. Leave every other \
field null. Never invent values, and do not derive one field from another (for example the \
courts from the governing law); suggest it and ask instead.
- To clear an optional field, set it to an empty string.
- Write values the way they read on a legal document: full company names, proper \
capitalization, dates as YYYY-MM-DD. Resolve relative dates like "next Monday" with the \
calendar below; do not work out weekdays yourself.

Today: {today}
The next two weeks:
{calendar}

Fields (id: description):
{fields}

Current values (JSON; fields not listed are empty):
{values}
"""

CAPTURE_LATEST = (
    "Capture every value the user gave or confirmed in their latest message, including "
    "corrections and values you did not ask about, for both parties."
)
CAPTURE_ALL = (
    "The user has just chosen this document, so capture every value they gave anywhere in the "
    "conversation so far, for both parties, and then ask about what is still missing."
)
JUST_CHOSEN = (
    "The user has just chosen the {name}. Before asking anything, put in `updates` every detail "
    "they already gave in the conversation above (company names, people and their titles, notice "
    "addresses, places, dates, terms), then ask about what is still missing. If they said why they "
    "need the agreement, that reason is a value too: record it in the field it belongs to, such "
    "as a purpose."
)


def _selection_messages(catalog: Catalog, history: list[Message]) -> list[Message]:
    documents = "\n".join(f"- {spec.id}: {spec.name}. {spec.description}" for spec in catalog.documents.values())
    return [{"role": "system", "content": SELECTION_PROMPT.format(documents=documents)}, *history]


def _document_messages(
    catalog: Catalog,
    spec: DocumentSpec,
    history: list[Message],
    values: Values,
    today: date,
    just_chosen: bool,
) -> list[Message]:
    # Defaults the model can see read as answers the user already gave, so it kept them over what
    # the user said (even with the default text shown apart). A just-chosen draft is shown empty,
    # its defaulted fields only named; `respond` keeps the defaults wherever the model sets nothing.
    shown = {} if just_chosen else values
    missing = spec.missing_fields(shown)
    optional = [
        field.label
        for field in spec.fields
        if not field.required and field.is_active(values) and not shown.get(field.id, "").strip()
    ]
    progress = (
        f"Still missing (required): {', '.join(missing) if missing else 'nothing, the document is complete'}.\n"
        f"Optional fields not filled in: {', '.join(optional) if optional else 'none'}."
    )
    defaulted = [spec.all_fields[key].label for key, value in values.items() if value] if just_chosen else []
    if defaulted:
        progress += (
            f"\nFields with a default, kept wherever `updates` is null (so leave a field null when the "
            f"user wants its default): {', '.join(defaulted)}."
        )
    system = DOCUMENT_PROMPT.format(
        name=spec.name,
        description=spec.description,
        progress=progress,
        role1=spec.parties[0],
        role2=spec.parties[1],
        documents=", ".join(f"{other.id} ({other.name})" for other in catalog.documents.values()),
        capture=CAPTURE_ALL if just_chosen else CAPTURE_LATEST,
        today=_day(today),
        # The model is unreliable at date arithmetic, so it gets the days spelled out.
        calendar="\n".join(f"- {_day(today + timedelta(days=n))}" for n in range(1, 15)),
        fields="\n".join(
            f"- {field.id}: {_describe(field)}{'' if field.required else ' [optional]'}"
            for field in spec.all_fields.values()
            if field.is_active(values)
        ),
        values=json.dumps({key: value for key, value in shown.items() if value}, indent=2),
    )
    messages = [{"role": "system", "content": system}, *history]
    if just_chosen:
        # Said only in the long system prompt, this was often skipped (up to 1 run in 4 when
        # tested); repeated after the conversation, the model recorded earlier details every time.
        messages.append({"role": "system", "content": JUST_CHOSEN.format(name=spec.name)})
    return messages


def _day(day: date) -> str:
    """e.g. "Wednesday: 2026-10-28"."""
    return f"{day:%A}: {day.isoformat()}"
