"""Account endpoints: sign up, sign in, sign out, and who is signed in.

Signing up or in sets an HttpOnly session cookie, which the browser then sends with every
request; the frontend and the API share an origin, so nothing else is needed.
"""

import sqlite3
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator

from .. import accounts
from ..accounts import MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, User
from ..config import Settings
from .deps import SESSION_COOKIE, UNAUTHORIZED, AppSettings, CurrentUser, Db, SessionToken

router = APIRouter()


class Credentials(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, email: Any) -> Any:
        return email.strip().lower() if isinstance(email, str) else email


class NewAccount(Credentials):
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)


class Account(BaseModel):
    email: str


@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_409_CONFLICT: {"description": "There is already an account with this email"}},
)
def sign_up(body: NewAccount, db: Db, response: Response, settings: AppSettings) -> Account:
    """Creates an account and signs in to it."""
    with db:
        try:
            user = accounts.create_user(db, body.email, body.password)
        except accounts.EmailTakenError:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "There is already an account with this email. Sign in instead."
            )
        _start_session(db, user, response, settings)
    return Account(email=user.email)


@router.post("/signin", responses=UNAUTHORIZED)
def sign_in(body: Credentials, db: Db, response: Response, settings: AppSettings) -> Account:
    """Signs in to an existing account."""
    with db:
        user = accounts.authenticate(db, body.email, body.password)
        if user is None:
            # The same answer whether or not the email has an account.
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
        _start_session(db, user, response, settings)
    return Account(email=user.email)


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(db: Db, response: Response, settings: AppSettings, token: SessionToken = None) -> None:
    """Ends the session, if there is one. Signing out twice is not an error."""
    if token:
        with db:
            accounts.end_session(db, token)
    response.delete_cookie(SESSION_COOKIE, **_cookie_options(settings))


@router.get("/me", responses=UNAUTHORIZED)
def me(user: CurrentUser) -> Account:
    """The signed-in user. The frontend asks on every page to decide what to show."""
    return Account(email=user.email)


def _start_session(db: sqlite3.Connection, user: User, response: Response, settings: Settings) -> None:
    token = accounts.start_session(db, user, datetime.now(UTC))
    response.set_cookie(
        SESSION_COOKIE, token, max_age=int(accounts.SESSION_LIFETIME.total_seconds()), **_cookie_options(settings)
    )


def _cookie_options(settings: Settings) -> dict[str, Any]:
    """The session cookie's attributes. Deleting the cookie needs the same ones as setting it."""
    return {
        "path": "/",
        "httponly": True,  # out of reach of scripts, so an injected script cannot steal it
        "samesite": "lax",  # not sent with cross-site POSTs, so other sites cannot act as the user
        "secure": settings.secure_cookies,
    }
