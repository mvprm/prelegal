# Prelegal backend

FastAPI app that serves the JSON API under `/api` and the frontend's static export
everywhere else. Managed with [uv](https://docs.astral.sh/uv/); requires Python 3.13.

```bash
uv run pytest                                                             # tests
uv run --env-file ../.env uvicorn --factory app.main:create_app --reload  # http://localhost:8000
```

`--env-file ../.env` loads `OPENROUTER_API_KEY` for the AI chat. Without it the rest of the
app works, but the chat answers `503`. The live LLM test in `tests/test_nda_live.py` reads the
key from the same file and is skipped without it.

## Structure

| Path | What it does |
| --- | --- |
| `app/main.py` | `create_app()`: resets the database on startup, mounts the API at `/api` and the frontend at `/` |
| `app/config.py` | `Settings`, read from the environment |
| `app/db.py` | SQLite connections and `reset_database()` |
| `app/schema.sql` | The whole database schema |
| `app/api/` | The API app: `health.py` (`GET /api/health`), `auth.py` (sign in / sign up) and `nda.py` (the NDA chat) |
| `app/nda.py` | The Mutual NDA's fields, the LLM's Structured Outputs schema and its prompt |
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

## NDA chat

`POST /api/nda/chat` is stateless: the browser sends the whole conversation (ending with the
user's message), the current fields and its local date, and gets back the assistant's reply
and the fields with the user's answers filled in.

The LLM answers with Structured Outputs (`ChatTurn` in `app/nda.py`): a `reply` and
`updates`, in which every field is null unless the user's latest message gave or changed it.
The backend merges the non-null values into the fields, so the model can never erase what
the user already entered. It drops values the fields would reject (a malformed date, years
below 1, text that is too long), because the browser sends the fields back with its next
message. LLM failures, including a blank reply, answer `502`, and a missing API key `503`.

## Settings

| Variable | Default | Docker image |
| --- | --- | --- |
| `PRELEGAL_DB_PATH` | `backend/data/prelegal.db` | `/data/prelegal.db` |
| `PRELEGAL_STATIC_DIR` | `frontend/out` | `/app/static` |

Without a frontend build, the app serves the API only.
