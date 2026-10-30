-- The database as of PL-12: accounts, their sessions and their saved documents.
-- Applied migrations never change: change the schema by adding the next numbered file.
-- Times are ISO 8601 UTC text (e.g. 2026-10-28T14:03:00.000Z), so they compare as text.

CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A signed-in browser. Its cookie holds a random token; only the token's SHA-256 is
-- stored, so the database alone cannot be used to sign in.
CREATE TABLE sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TEXT    NOT NULL
);

-- A user's saved document. The browser picks the id (a UUID) when the draft starts, so
-- saving is a repeatable "create or update" rather than a create followed by updates.
CREATE TABLE documents (
    id          TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    document_id TEXT    NOT NULL, -- the kind of document, an id from documents.json
    values_json TEXT    NOT NULL, -- the field values, a JSON object of strings
    title       TEXT,             -- a name the user gave it, or NULL for the document's own name
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX documents_by_user ON documents (user_id, updated_at DESC);
