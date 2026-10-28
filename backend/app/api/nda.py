"""Mutual NDA endpoints: the AI chat that fills in the cover page.

The chat is stateless. The browser keeps the conversation and the fields and sends both
with every message; the reply carries the fields with the user's answers filled in.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from .. import llm
from ..nda import MAX_MESSAGE_LENGTH, ChatTurn, NdaFields, apply_updates, build_messages

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChatRequest(BaseModel):
    messages: Annotated[list[ChatMessage], Field(min_length=1, max_length=200)]
    """The conversation so far, ending with the user's new message. The browser sends only
    the latest messages (`MAX_HISTORY` in chat.ts); the fields carry what older ones settled."""
    fields: NdaFields
    """The values as the user currently sees them, including edits made in the form."""
    today: date
    """The user's local date, used to resolve relative dates such as "tomorrow"."""

    @field_validator("messages")
    @classmethod
    def ends_with_user_message(cls, messages: list[ChatMessage]) -> list[ChatMessage]:
        if messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return messages


class ChatResponse(BaseModel):
    reply: str
    fields: NdaFields


ERRORS = {
    status.HTTP_502_BAD_GATEWAY: {"description": "The AI assistant failed to answer"},
    status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "No API key is configured for the AI assistant"},
}


@router.post("/chat", responses=ERRORS)
def chat(request: ChatRequest) -> ChatResponse:
    """Answers the user's latest message and fills in any values it gave."""
    history = [message.model_dump() for message in request.messages]
    try:
        turn = llm.structured_completion(build_messages(history, request.fields, request.today), ChatTurn)
    except llm.LlmNotConfiguredError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The AI assistant is not configured")
    except llm.LlmError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI assistant could not answer. Please try again.")
    return ChatResponse(reply=turn.reply, fields=apply_updates(request.fields, turn.updates))
