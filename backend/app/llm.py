"""LLM calls: gpt-oss-120b through OpenRouter, served by Cerebras, via LiteLLM.

LiteLLM reads the API key from the `OPENROUTER_API_KEY` environment variable.
"""

import logging
import os

from litellm import completion
from pydantic import BaseModel

log = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}


class LlmError(Exception):
    """The LLM could not be reached or did not answer in the requested format."""


class LlmNotConfiguredError(LlmError):
    """No API key is set, so no call can succeed."""


def structured_completion[T: BaseModel](messages: list[dict[str, str]], response_model: type[T]) -> T:
    """Sends `messages` and returns the reply parsed as `response_model` (Structured Outputs)."""
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise LlmNotConfiguredError("OPENROUTER_API_KEY is not set")
    try:
        response = completion(
            model=MODEL,
            messages=messages,
            response_format=response_model,
            reasoning_effort="low",
            extra_body=EXTRA_BODY,
        )
        return response_model.model_validate_json(response.choices[0].message.content)
    except Exception as e:
        # LiteLLM raises many exception types (network, rate limits, provider errors), and
        # a malformed reply raises pydantic's ValidationError; callers only need to know it failed.
        log.exception("LLM call failed")
        raise LlmError(str(e)) from e
