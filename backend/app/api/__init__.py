"""All JSON endpoints, as an app of their own that main.py mounts at /api."""

from fastapi import FastAPI

from ..chat import Assistant
from ..config import Settings
from ..documents import Catalog
from . import auth, chat, health


def create_api(settings: Settings) -> FastAPI:
    """Builds the API app.

    It is a separate app rather than a router so every /api request is answered by the
    API alone: unknown paths and wrong methods get JSON 404 and 405 errors instead of
    falling through to the frontend's HTML pages.
    """
    api = FastAPI(title="Prelegal API", docs_url="/docs", openapi_url="/openapi.json", redoc_url=None)
    api.include_router(health.router)
    api.include_router(auth.router, prefix="/auth", tags=["auth"])
    api.include_router(chat.router, tags=["chat"])
    # Loaded once: a malformed documents.json stops the app at startup rather than mid-chat.
    api.state.assistant = Assistant(Catalog.load(settings.documents_path))
    return api
