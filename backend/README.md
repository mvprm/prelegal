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
| `app/api/` | The API app: `health.py` (`GET /api/health`), `auth.py` (sign in / sign up) and `chat.py` (`POST /api/chat`) |
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
that file. It currently holds a `users` table (unique, case-insensitive `email`,
`password_hash`, `created_at`).

## Accounts

`POST /api/auth/signup` and `POST /api/auth/signin` are placeholders. They validate the
request body (`{"email": ..., "password": ...}`; a malformed body gets `422`) and then answer
`501 Not Implemented`.

## Documents

`documents.json` in the repository root lists the 11 supported documents: for each, its
Standard Terms template, the two parties' roles, and its fields (id, label, type, whether it
is required, a default, and a description that both the form and the LLM see). Field types
are `text`, `longtext`, `date`, `choice` and `years`; a field can apply only while another
has a given value (`when`). Each party also gets a name, title, company and notice address.
Every value is a string. The frontend reads the same file and applies the same rules.

## Chat

`POST /api/chat` is stateless: the browser sends the latest messages (ending with the user's),
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

Without a frontend build, the app serves the API only.
