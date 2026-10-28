# Prelegal backend

FastAPI app that serves the JSON API under `/api` and the frontend's static export
everywhere else. Managed with [uv](https://docs.astral.sh/uv/); requires Python 3.13.

```bash
uv run pytest                                           # tests
uv run uvicorn --factory app.main:create_app --reload   # http://localhost:8000
```

## Structure

| Path | What it does |
| --- | --- |
| `app/main.py` | `create_app()`: resets the database on startup, mounts the API at `/api` and the frontend at `/` |
| `app/config.py` | `Settings`, read from the environment |
| `app/db.py` | SQLite connections and `reset_database()` |
| `app/schema.sql` | The whole database schema |
| `app/api/` | The API app: `health.py` (`GET /api/health`) and `auth.py` (sign in / sign up) |
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

## Settings

| Variable | Default | Docker image |
| --- | --- | --- |
| `PRELEGAL_DB_PATH` | `backend/data/prelegal.db` | `/data/prelegal.db` |
| `PRELEGAL_STATIC_DIR` | `frontend/out` | `/app/static` |

Without a frontend build, the app serves the API only.
