"""The signed-in user's saved documents.

The browser saves the draft automatically as the user works on it. It picks each
document's id (a UUID) when the draft starts, so `PUT /documents/{id}` both creates and
updates it, and repeating a save is harmless. Drafts may be incomplete; only the document
and its field names are checked. Another user's document answers 404, as if it did not exist.

A document can also have a name of the user's own (`title`), set with `PATCH` alone, so an
automatic save sent before a rename can never undo it.
"""

import json
import sqlite3
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status

from ..documents import Catalog, CamelModel, InvalidDraftError, ValuesInput
from .deps import CurrentUser, Db

router = APIRouter()

MAX_TITLE_LENGTH = 120
"""The longest name a user can give a document (`MAX_TITLE_LENGTH` in saved.ts)."""


class DocumentDraft(CamelModel):
    document_id: str
    """The kind of document, an id from documents.json."""
    values: ValuesInput
    """The field values; fields left out count as empty."""


class DocumentTitle(CamelModel):
    title: str
    """The document's name; empty goes back to the name of its kind of document."""


class SavedDocument(DocumentDraft):
    id: UUID
    title: str | None
    """The name the user gave it, if any."""
    created_at: str
    updated_at: str


NOT_FOUND = {status.HTTP_404_NOT_FOUND: {"description": "The user has no document with this id"}}


@router.get("/documents")
def list_documents(user: CurrentUser, db: Db) -> list[SavedDocument]:
    """The user's documents, most recently changed first."""
    rows = db.execute(
        "SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC", (user.id,)
    ).fetchall()
    return [_saved(row) for row in rows]


@router.get("/documents/{id}", responses=NOT_FOUND)
def get_document(id: UUID, user: CurrentUser, db: Db) -> SavedDocument:
    """One of the user's documents, with its values."""
    row = db.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (str(id), user.id)).fetchone()
    if row is None:
        raise _not_found()
    return _saved(row)


@router.put("/documents/{id}", responses=NOT_FOUND)
def save_document(id: UUID, body: DocumentDraft, user: CurrentUser, db: Db, request: Request) -> SavedDocument:
    """Creates the document, or replaces its contents if the user already has it."""
    catalog: Catalog = request.app.state.catalog
    try:
        values = catalog.require(body.document_id).complete_values(body.values)
    except InvalidDraftError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e))
    with db:
        # The WHERE leaves another user's document with this id untouched, and returns no row.
        row = db.execute(
            "INSERT INTO documents (id, user_id, document_id, values_json) VALUES (?, ?, ?, ?) "
            "ON CONFLICT (id) DO UPDATE SET document_id = excluded.document_id, "
            "values_json = excluded.values_json, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
            "WHERE documents.user_id = excluded.user_id "
            "RETURNING *",
            (str(id), user.id, body.document_id, json.dumps(values)),
        ).fetchone()
    if row is None:
        raise _not_found()
    return _saved(row)


@router.patch("/documents/{id}", responses=NOT_FOUND)
def rename_document(id: UUID, body: DocumentTitle, user: CurrentUser, db: Db) -> SavedDocument:
    """Gives the document a name of the user's own, or with an empty one, its default name back.

    Renaming leaves `updatedAt` alone, so My documents keeps its order and when each draft was
    last worked on.
    """
    title = body.title.strip()
    # Checked here rather than by the model, so the message is one the browser can show.
    if len(title) > MAX_TITLE_LENGTH:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"The name can be at most {MAX_TITLE_LENGTH} characters long."
        )
    with db:
        row = db.execute(
            "UPDATE documents SET title = ? WHERE id = ? AND user_id = ? RETURNING *",
            (title or None, str(id), user.id),
        ).fetchone()
    if row is None:
        raise _not_found()
    return _saved(row)


@router.delete("/documents/{id}", status_code=status.HTTP_204_NO_CONTENT, responses=NOT_FOUND)
def delete_document(id: UUID, user: CurrentUser, db: Db) -> None:
    """Deletes one of the user's documents for good."""
    with db:
        deleted = db.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (str(id), user.id)).rowcount
    if not deleted:
        raise _not_found()


def _saved(row: sqlite3.Row) -> SavedDocument:
    return SavedDocument(
        id=row["id"],
        document_id=row["document_id"],
        values=json.loads(row["values_json"]),
        title=row["title"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
