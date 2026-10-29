# Prelegal backend

FastAPI app that serves the JSON API under `/api` and the frontend's static export
everywhere else. Managed with [uv](https://docs.astral.sh/uv/); requires Python 3.13.

```bash
uv run pytest                                                             # tests
uv run --env-file ../.env uvicorn --factory app.main:create_app --reload  # http://localhost:8000
```

`--env-file ../.env` loads `OPENROUTER_API_KEY` for the AI chat. Without it the rest of the
app works, but the chat answers `503`. The live LLM tests in `tests/test_chat_live.py` read the
key from the same file and are skipped without it.

## Structure

| Path | What it does |
| --- | --- |
| `app/main.py` | `create_app()`: resets the database on startup, mounts the API at `/api` and the frontend at `/` |
| `app/config.py` | `Settings`, read from the environment |
| `app/db.py` | SQLite connections and `reset_database()` |
| `app/schema.sql` | The whole database schema |
| `app/api/` | The API app: `health.py` (`GET /api/health`), `auth.py` (accounts), `documents.py` (saved documents), `chat.py` (`POST /api/chat`), and `deps.py` (the request's database connection and signed-in user) |
| `app/accounts.py` | Password hashing (scrypt) and sign-in sessions |
| `app/documents.py` | `Catalog`: the supported documents and their fields, loaded from `../documents.json` |
| `app/chat.py` | `Assistant`: the prompts, the per-document Structured Outputs schemas, and merging the answers |
| `app/llm.py` | `structured_completion()`: LiteLLM via OpenRouter to `gpt-oss-120b` on Cerebras |
| `tests/` | pytest tests against a real temporary database and a miniature frontend export |

The API is a separate FastAPI app mounted at `/api`, so unknown `/api` paths and wrong
methods get JSON errors rather than the frontend's 404 page. Its interactive docs are at
`/api/docs`.

## Database

The database is temporary: every time the app starts, it deletes the SQLite file and
recreates it from `app/schema.sql`. There are no migrations, so change the schema by editing
that file. It holds `users`, their `sessions`, and their saved `documents`; deleting a user
deletes the other two. Because of the reset, accounts and documents last only until the app
restarts.

## Accounts

| Endpoint | What it does |
| --- | --- |
| `POST /api/auth/signup` | `{email, password}` (8 to 128 characters). Creates the account and signs in; `409` if the email (in any case) is taken |
| `POST /api/auth/signin` | Signs in; `401` "Incorrect email or password." whether or not the email exists |
| `POST /api/auth/signout` | Ends the session and clears the cookie; `204`, also without a session |
| `GET /api/auth/me` | `{email}` of the signed-in user, or `401` |

Passwords are stored as salted scrypt hashes. Signing in starts a session that lasts 7 days:
a random token in the `prelegal_session` cookie (HttpOnly, SameSite=Lax, and Secure when
`PRELEGAL_SECURE_COOKIES` is on), of which the database keeps only a SHA-256 hash. The
frontend is served from the same origin, so the browser sends the cookie with every API
request. Everything except the health check and these endpoints answers `401` without a
valid session (`get_current_user` in `app/api/deps.py`).

## Saved documents

| Endpoint | What it does |
| --- | --- |
| `GET /api/documents` | The user's documents, most recently updated first |
| `GET /api/documents/{id}` | One document |
| `PUT /api/documents/{id}` | `{documentId, values}`: creates the document or replaces its contents |
| `DELETE /api/documents/{id}` | Deletes it (`204`) |

The browser picks each document's id (a UUID) when the draft starts and saves it with `PUT`
as the user works, so saving the same draft twice is harmless. Drafts may be incomplete: a
save checks only that the document exists and has those fields (`422` otherwise), and fills
in missing fields as empty. Another user's document answers `404`, exactly like a missing one.

## Documents

`documents.json` in the repository root lists the 11 supported documents: for each, its
Standard Terms template, the two parties' roles, and its fields (id, label, type, whether it
is required, a default, and a description that both the form and the LLM see). Field types
are `text`, `longtext`, `date`, `choice` and `years`; a field can apply only while another
has a given value (`when`). Each party also gets a name, title, company and notice address.
Every value is a string. The frontend reads the same file and applies the same rules.

## Chat

`POST /api/chat` needs a signed-in user and is stateless: the browser sends the latest messages (ending with the user's),
the draft (`documentId`, or null until one is chosen, and `values`) and its local date, and
gets back the assistant's reply and the draft as it now stands.

Each turn is one or two Structured Outputs calls (`Assistant.respond` in `app/chat.py`):

1. Until a document is chosen, the LLM sees the catalog and answers `{reply, question,
   documentId}`. It picks a document when one clearly fits, and otherwise explains what
   Prelegal cannot draft and offers the closest supported document.
2. Once there is a document, the schema is built from its fields: `{reply, question, updates,
   switchTo}`, where every field in `updates` is null unless the user gave or changed it. On
   the turn a document is chosen (or switched to with `switchTo`), the LLM is told to capture
   everything said so far in the conversation.

The backend merges the non-null updates, so the model can never erase what the user already
entered, and drops values the fields would reject (such as a malformed date), because the
browser sends the values back with its next message. The reply always asks the user
something: `question` is required, and if it contains no question mark the backend adds one
about the next missing field. LLM failures answer `502`, and a missing API key `503`.

## Settings

| Variable | Default | Docker image |
| --- | --- | --- |
| `PRELEGAL_DB_PATH` | `backend/data/prelegal.db` | `/data/prelegal.db` |
| `PRELEGAL_STATIC_DIR` | `frontend/out` | `/app/static` |
| `PRELEGAL_DOCUMENTS_PATH` | `documents.json` | `/app/documents.json` |
| `PRELEGAL_SECURE_COOKIES` | `false` | `false` (turn on when serving over HTTPS) |

Without a frontend build, the app serves the API only.
