# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The goal is to support all 11 document types via AI chat with full user authentication and document persistence. See "Implementation status" at the end for what exists today.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
The frontend is statically built (Next.js `output: "export"`) and served by FastAPI.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

These are Tailwind theme tokens in `frontend/src/app/globals.css`: `brand-yellow`, `brand-blue`, `brand-purple`, `brand-navy`, `brand-gray`. Light mode only.

## Implementation status

Jira project **PL**. Branches are `feature/PL-N-slug`, merged into `main` with `Merge branch '...' (PL-N, #PR)`.

### PL-1: Company website (to do)

### PL-2: Legal templates (done)
- Common Paper agreement templates in `templates/` (markdown, CC BY 4.0), listed in `catalog.json`.
- Only the Mutual NDA templates are used so far.

### PL-3: Mutual NDA creator prototype (done)
- Next.js 16 app in `frontend/`. Form at `/nda` with a live preview and PDF download (`@react-pdf/renderer`).
- Filling, parsing and PDF generation run in the browser (`src/lib/nda/`, `src/components/nda/`).
- Templates are read from `../templates` at build time, so builds need the full repo.
- Tests: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` in `frontend/`.

### PL-4: V1 foundation (done)
- **Backend** (`backend/`, uv, Python 3.13): `app/main.py` `create_app()` resets the DB on startup, mounts the API sub-app at `/api` (docs at `/api/docs`) and the static frontend at `/`. Add endpoints as routers in `app/api/`. Settings: `PRELEGAL_DB_PATH`, `PRELEGAL_STATIC_DIR`. Tests: `uv run pytest` (real temp SQLite, no mocks).
- **Database**: SQLite `users` table. Schema in `app/schema.sql`; no migrations, since the DB is recreated every start.
- **Auth (placeholder)**: `/signin` and `/signup` pages show "coming soon" and never call the API. `POST /api/auth/signup|signin` validate the body, then return 501. No sessions or password hashing yet.
- **Frontend**: switched to a static export (`output: "export"`, `trailingSlash: true`), so no route handlers, server actions, rewrites or `cacheComponents`. Restyled with the brand palette; dark mode removed.
- **Docker + scripts**: multi-stage `Dockerfile` (Node build, then Python runtime as non-root with a health check on `/api/health`). DB at `/data/prelegal.db` in the container. Start/stop scripts in `scripts/`.
- **LLM**: `.env` (with `OPENROUTER_API_KEY`) is passed to the container via `--env-file`.

### PL-5: AI chat for the Mutual NDA (done)
- `/nda` has two tabs: "Chat with AI" (default) and "Edit fields" (the PL-3 form), both filling the same fields and live preview. The form is disabled while the AI replies.
- `POST /api/nda/chat` (`app/api/nda.py`) is stateless: the browser sends the latest 40 messages, the fields and `today`, and gets `{reply, fields}`. The LLM returns Structured Outputs `{reply, updates}` (`app/nda.py`), where null means unchanged; the backend merges the updates and drops invalid ones, so it never returns fields it would reject.
- `app/llm.py` `structured_completion()` wraps LiteLLM (Cerebras skill) and is stubbed in tests; `tests/test_nda_live.py` calls the real model and is skipped without a key. Run the backend locally with `uv run --env-file ../.env ...`.
- Frontend: `src/lib/nda/chat.ts` (API client, greeting), `src/components/nda/useNdaChat.ts` and `NdaChat.tsx`. Chat history lives only in the page; refreshing starts over.
