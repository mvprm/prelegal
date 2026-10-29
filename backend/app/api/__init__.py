"""All JSON endpoints, as an app of their own that main.py mounts at /api."""

from fastapi import Depends, FastAPI

from ..chat import Assistant
from ..config import Settings
from ..documents import Catalog
from . import auth, chat, documents, health
from .deps import UNAUTHORIZED, get_current_user


def create_api(settings: Settings) -> FastAPI:
    """Builds the API app.

    It is a separate app rather than a router so every /api request is answered by the
    API alone: unknown paths and wrong methods get JSON 404 and 405 errors instead of
    falling through to the frontend's HTML pages.

    Everything except the health check and the account endpoints needs a signed-in user.
    """
    api = FastAPI(title="Prelegal API", docs_url="/docs", openapi_url="/openapi.json", redoc_url=None)
    api.include_router(health.router)
    api.include_router(auth.router, prefix="/auth", tags=["auth"])
    signed_in = {"dependencies": [Depends(get_current_user)], "responses": UNAUTHORIZED}
    api.include_router(chat.router, tags=["chat"], **signed_in)
    api.include_router(documents.router, tags=["documents"], **signed_in)

    api.state.settings = settings
    # Loaded once: a malformed documents.json stops the app at startup rather than mid-chat.
    api.state.catalog = Catalog.load(settings.documents_path)
    api.state.assistant = Assistant(api.state.catalog)
    return api
