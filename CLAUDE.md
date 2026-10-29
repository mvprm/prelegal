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
- All of them are used since PL-6; their fields are described in `documents.json`.

### PL-3: Mutual NDA creator prototype (done)
- Next.js 16 app in `frontend/`. Live preview and PDF download (`@react-pdf/renderer`); generalized to all documents at `/draft` in PL-6.
- Filling, parsing and PDF generation run in the browser (`src/lib/documents/`, `src/components/documents/`).
- Templates are read from `../templates` at build time, so builds need the full repo.
- Tests: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` in `frontend/`.

### PL-4: V1 foundation (done)
- **Backend** (`backend/`, uv, Python 3.13): `app/main.py` `create_app()` resets the DB on startup, mounts the API sub-app at `/api` (docs at `/api/docs`) and the static frontend at `/`. Add endpoints as routers in `app/api/`. Settings: `PRELEGAL_DB_PATH`, `PRELEGAL_STATIC_DIR`, `PRELEGAL_DOCUMENTS_PATH`, `PRELEGAL_SECURE_COOKIES`. Tests: `uv run pytest` (real temp SQLite; only the LLM is stubbed).
- **Database**: SQLite, schema in `app/schema.sql` (`users`, `sessions`, `documents` since PL-7); no migrations, since the DB is recreated every start.
- **Auth**: placeholder in PL-4, real since PL-7 (below).
- **Frontend**: switched to a static export (`output: "export"`, `trailingSlash: true`), so no route handlers, server actions, rewrites or `cacheComponents`. Restyled with the brand palette; dark mode removed.
- **Docker + scripts**: multi-stage `Dockerfile` (Node build, then Python runtime as non-root with a health check on `/api/health`). DB at `/data/prelegal.db` in the container. Start/stop scripts in `scripts/`.
- **LLM**: `.env` (with `OPENROUTER_API_KEY`) is passed to the container via `--env-file`.

### PL-5: AI chat for the Mutual NDA (done; generalized in PL-6)
- Two tabs: "Chat with AI" (default) and "Edit fields", both filling the same values and live preview. The form is disabled while the AI replies. Chat history lives only in the page; refreshing starts over.
- The chat is stateless and the LLM returns Structured Outputs where null means unchanged; the backend merges the updates and drops invalid ones, so it never returns values it would reject.
- `app/llm.py` `structured_completion()` wraps LiteLLM (Cerebras skill) and is stubbed in tests (`monkeypatch` on `app.llm`); live tests call the real model and are skipped without a key. Run the backend locally with `uv run --env-file ../.env ...`.

### PL-6: All document types (done)
- `documents.json` (repo root) is the single spec for all 11 documents: Standard Terms file, party roles, fields (`text`/`longtext`/`date`/`choice`/`years`, `required`, `default` incl. `"today"`, `when` conditions). Values are a flat `Record<string, string>`; party fields are `party1.company` etc. Frontend `src/lib/documents/catalog.ts` and backend `app/documents.py` apply the same rules, so change both together. Docker copies it into both stages (`PRELEGAL_DOCUMENTS_PATH`).
- `/draft` replaces `/nda`: the AI picks the document, or explains an unsupported one and offers the closest. `POST /api/chat` (`app/api/chat.py`) takes `{messages, documentId|null, values, today}` and returns `{reply, documentId, values}`.
- `app/chat.py` `Assistant`: a selection schema until a document is chosen, then a per-document schema built from its fields (`updates`, `switchTo`). Replies are `reply` + required `question`; a question without "?" gets a fallback question about the next missing field. On the turn a document is chosen, a trailing system message makes the model capture details from the whole conversation.
- Cover pages: the NDA fills its official template (`ndaCoverPage.ts`); the others are generated from the fields (`coverPage.ts`). Section titles (`header_N` spans) render bold. A frontend test checks that every `*_link` term in each template has a field.
- The chat's focus returns to the message box after every reply.

### PL-7: Accounts, saved documents, polish (done)
- Every page but `/signin` and `/signup` needs an account. Backend: `app/accounts.py` (scrypt password hashes; sessions = random token in an HttpOnly SameSite=Lax `prelegal_session` cookie, SHA-256 stored, 7 days), `app/api/auth.py` (`signup`, `signin`, `signout`, `me`), `app/api/deps.py` (`Db` per-request connection, `CurrentUser`). `/api/chat` and `/api/documents` need a session (401 otherwise); `/api/health` stays public. Tests: `user_client` / `other_client` fixtures in `tests/conftest.py`.
- Saved documents: `app/api/documents.py`, `GET/PUT/DELETE /api/documents/{id}` and `GET /api/documents`. Ids are UUIDs made by the browser, so `PUT` is an idempotent create-or-update; another user's id answers 404. Drafts may be incomplete (only the document and field names are checked).
- Frontend: `AuthProvider` (in the root layout) + `AuthGate` (client-side redirects, `src/lib/auth/redirect.ts`, `?next=` back after sign in); `src/lib/api.ts` `apiRequest`/`ApiError` for every API call (any 401 signs the user out of the UI). `/` is My documents (`MyDocuments.tsx`: open, download PDF, delete). `/draft/?id=…` (`DraftWorkspace.tsx`): a new draft gets an id first; it is saved automatically once a document is chosen (`lib/documents/autosave.ts` + `useAutosave.ts`). Reopening starts a fresh chat, values only.
- Polish: shared `AppShell` header/footer and `components/ui.tsx` (buttons, inputs, logo, loading); split-screen sign in / sign up. Disclaimer (`src/lib/legal.ts`) on the draft preview, in every PDF page footer and in the app footer.
- Known: in the static export, Next's client-side navigation asks for `…/__next.<route>.__PAGE__.txt` files that are exported as `__next.<route>/__PAGE__.txt`, so those requests 404 and navigation falls back to full page loads.
