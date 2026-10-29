"""The FastAPI app. Run with `uvicorn --factory app.main:create_app`."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .api import create_api
from .config import Settings
from .db import reset_database

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Builds the app: the API under /api, and the frontend's static export everywhere else."""
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        reset_database(settings.db_path)
        yield

    # No docs on the outer app: the mounted API app serves them at /api/docs.
    app = FastAPI(title="Prelegal", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.mount("/api", create_api(settings))

    # Mounted last so /api takes precedence. With html=True, /draft/ serves draft/index.html,
    # /draft redirects to /draft/, and unknown paths get the exported 404.html.
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")
    else:
        log.warning("No frontend build at %s; serving the API only", settings.static_dir)

    return app
