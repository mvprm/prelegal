"""Account endpoints. Placeholders for now: the request format is fixed, but both
endpoints answer 501 Not Implemented until accounts are built."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


class Credentials(BaseModel):
    # A loose shape check only; real validation arrives with the accounts feature.
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    password: str = Field(min_length=1, max_length=128)


NOT_IMPLEMENTED = {status.HTTP_501_NOT_IMPLEMENTED: {"description": "Accounts are not implemented yet"}}


@router.post("/signup", responses=NOT_IMPLEMENTED)
def sign_up(credentials: Credentials) -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Sign up is not implemented yet")


@router.post("/signin", responses=NOT_IMPLEMENTED)
def sign_in(credentials: Credentials) -> None:
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Sign in is not implemented yet")
