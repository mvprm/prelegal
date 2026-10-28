"""The AI chat that picks a document and fills in its fields.

The chat is stateless. The browser keeps the conversation and the draft (the chosen
document, if any, and its values) and sends them with every message; the reply carries
the draft as it now stands.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from .. import llm
from ..chat import MAX_MESSAGE_LENGTH, Assistant
from ..documents import MAX_VALUE_LENGTH, CamelModel, InvalidDraftError

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChatRequest(CamelModel):
    messages: Annotated[list[ChatMessage], Field(min_length=1, max_length=200)]
    """The conversation so far, ending with the user's new message. The browser sends only
    the latest messages (`MAX_HISTORY` in chat.ts); the values carry what older ones settled."""
    document_id: str | None
    """The document being drafted, or null until the assistant has chosen one."""
    values: Annotated[dict[str, Annotated[str, Field(max_length=MAX_VALUE_LENGTH)]], Field(max_length=200)]
    """The document's values as the user currently sees them, including edits made in the form.
    Fields left out count as empty."""
    today: date
    """The user's local date, used for default dates and to resolve ones like "tomorrow"."""

    @field_validator("messages")
    @classmethod
    def ends_with_user_message(cls, messages: list[ChatMessage]) -> list[ChatMessage]:
        if messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return messages


class ChatResponse(CamelModel):
    reply: str
    document_id: str | None
    values: dict[str, str]


ERRORS = {
    status.HTTP_502_BAD_GATEWAY: {"description": "The AI assistant failed to answer"},
    status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "No API key is configured for the AI assistant"},
}


@router.post("/chat", responses=ERRORS)
def chat(body: ChatRequest, request: Request) -> ChatResponse:
    """Answers the user's latest message, choosing the document and filling in its values."""
    assistant: Assistant = request.app.state.assistant
    history = [message.model_dump() for message in body.messages]
    try:
        result = assistant.respond(history, body.document_id, body.values, body.today)
    except InvalidDraftError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e))
    except llm.LlmNotConfiguredError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The AI assistant is not configured")
    except llm.LlmError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI assistant could not answer. Please try again.")
    return ChatResponse(reply=result.reply, document_id=result.document_id, values=result.values)
