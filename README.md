# Prelegal

A platform for drafting common legal agreements. Users answer a few questions about their
deal, and Prelegal fills in a standard, lawyer-drafted agreement template and gives them a
completed document to download.

## Status

🚧 **Work in progress.** This project is under active development and is expected to be
completed by **November 3, 2026**.

## Scope

Work is tracked in Jira (project **PL**).

| Ticket | Scope | Status |
| --- | --- | --- |
| PL-1 | A simple website that describes the Prelegal company | To do |
| PL-2 | A dataset of legal agreement templates the system can later fill in for users | ✅ Done |
| PL-3 | Prototype of a Mutual NDA creator: the user fills in a form, sees the completed NDA and downloads it | ✅ Done |
| PL-4 | Technical foundation for V1: FastAPI backend, temporary SQLite database, Docker container and start/stop scripts, placeholder sign in / sign up | ✅ Done |
| PL-5 | AI chat for the Mutual NDA: a freeform chat fills in the NDA instead of a form | ✅ Done |
| PL-6 | All 11 agreement types via AI chat, with help choosing the right one | ✅ Done |
| PL-7 | Accounts (sign up, sign in) with saved documents, a professional look, and a draft disclaimer | ✅ Done |
| PL-8 | Bug fixes: choose the document from a list as well as the chat; reopening a saved document shows it | ✅ Done |

### Agreement templates (PL-2)

All agreement text comes from [Common Paper](https://github.com/CommonPaper)'s standard
agreements and is stored in [`templates/`](templates/) as markdown. It is listed in
[`catalog.json`](catalog.json), which gives the name, description and filename of each
template:

- Mutual Non-Disclosure Agreement (Standard Terms and Cover Page)
- Cloud Service Agreement
- Service Level Agreement
- Data Processing Agreement
- Design Partner Agreement
- Professional Services Agreement
- Partnership Agreement
- Business Associate Agreement
- Software License Agreement
- Pilot Agreement
- AI Addendum

All of them can be drafted. [`documents.json`](documents.json) describes the fields of each
one, which drive the AI chat, the form and the generated cover page.

### Drafting an agreement (PL-3, PL-5, PL-6, PL-7)

Everyone needs an account: visitors who are not signed in are sent to sign in or sign up.
Signed-in users land on **My documents**, which lists the agreements they have drafted, to
open and keep editing, download as a PDF, or delete. **New document** opens `/draft`, where
the user:

1. Picks an agreement from the list, or tells an AI assistant what they need. The assistant
   picks the right agreement, or, for a document Prelegal cannot draft, says so and offers the
   closest one it can.
2. Answers the assistant's questions about the parties and the terms, or fills in the fields
   in a form instead. The agreement (cover page and Standard Terms) updates as they go.
3. Downloads the completed agreement as a PDF, ready for legal review and signature.

The draft is saved to the user's account automatically as they go. Every document, on screen
and in the PDF, says that it is a draft that should be reviewed by a lawyer before signing.
The chat goes through the backend to an LLM; the preview and the PDF are made in the browser.

### V1 foundation (PL-4)

The app now runs as a single Docker container: a FastAPI backend serves the JSON API under
`/api` and the statically built frontend everywhere else. It uses a temporary SQLite
database with a `users` table that is recreated empty every time the container starts.

Accounts were added in PL-7. Like everything else in the database, they last until the
container restarts.

## Running Prelegal

Requires [Docker](https://www.docker.com/). From the repository root:

| | Start | Stop |
| --- | --- | --- |
| macOS | `scripts/start-mac.sh` | `scripts/stop-mac.sh` |
| Linux | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows | `scripts\start-windows.ps1` | `scripts\stop-windows.ps1` |

Start builds the image and runs it at **http://localhost:8000** (API docs at
http://localhost:8000/api/docs). If a `.env` file exists in the repository root, its
variables are passed to the container. Stop removes the container, and with it the
database.

## Repository layout

```
prelegal/
├── catalog.json   # Name, description and filename of every template
├── documents.json # The supported documents and their fields, shared by frontend and backend
├── templates/     # Common Paper agreement templates (markdown, CC BY 4.0)
├── frontend/      # Next.js web app, exported as static files
├── backend/       # FastAPI app: the API and the server for the frontend
├── scripts/       # Start and stop scripts for macOS, Linux and Windows
└── Dockerfile     # Builds the frontend, then packages it with the backend
```

## Frontend

The frontend is a [Next.js](https://nextjs.org) 16 app (App Router, TypeScript, Tailwind
CSS v4) in [`frontend/`](frontend/). It reads the agreement text from `templates/` and the
fields from `documents.json` at build time, so they are the single source of truth. The app
is exported as static files (`output: "export"`) that the backend serves. PDFs are
generated in the browser with [`@react-pdf/renderer`](https://react-pdf.org).

### Getting started

Requires **Node.js 24**. Run these from the `frontend/` directory in a full checkout of the
repository, since the app reads `../templates` and `../documents.json`:

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000; signing in and the chat need the backend
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run the unit tests (Vitest), including a real PDF render |
| `npm run lint` | Lint with ESLint |
| `npx tsc --noEmit` | Type-check |
| `npm run build` | Export the static site to `frontend/out/` |

See [`frontend/README.md`](frontend/README.md) for how filling, parsing and PDF rendering
work.

## Backend

The backend is a [FastAPI](https://fastapi.tiangolo.com) app in [`backend/`](backend/),
managed with [uv](https://docs.astral.sh/uv/). To run it without Docker, build the frontend
first (`npm run build` in `frontend/`), then:

```bash
cd backend
uv run --env-file ../.env uvicorn --factory app.main:create_app --reload   # http://localhost:8000
```

| Command | What it does |
| --- | --- |
| `uv run pytest` | Run the tests |
| `uv run uvicorn --factory app.main:create_app` | Serve the API and `../frontend/out` at http://localhost:8000 |

See [`backend/README.md`](backend/README.md) for its structure and settings.

## License

- **Code** is released under the [MIT License](LICENSE).
- **Agreement templates** in `templates/` are © Common Paper, used under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See
  [`templates/LICENSE.txt`](templates/LICENSE.txt) for attribution details. Prelegal is not
  affiliated with or endorsed by Common Paper, and nothing in this project is legal advice.
