"""Dependencies shared by the endpoints: the database and the signed-in user."""

import sqlite3
from collections.abc import Iterator
from contextlib import closing
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status

from ..accounts import User, session_user
from ..config import Settings
from ..db import connect

SESSION_COOKIE = "prelegal_session"

UNAUTHORIZED = {status.HTTP_401_UNAUTHORIZED: {"description": "Not signed in, or the session has expired"}}


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


AppSettings = Annotated[Settings, Depends(get_settings)]


def get_db(settings: AppSettings) -> Iterator[sqlite3.Connection]:
    """A connection for this request, closed when it ends. Writes commit with `with db:`."""
    with closing(connect(settings.db_path)) as conn:
        yield conn


Db = Annotated[sqlite3.Connection, Depends(get_db)]
SessionToken = Annotated[str | None, Cookie(alias=SESSION_COOKIE, include_in_schema=False)]


def get_current_user(db: Db, token: SessionToken = None) -> User:
    """The signed-in user, or 401 if the request has no valid session."""
    user = session_user(db, token, datetime.now(UTC)) if token else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
