# Prelegal frontend

Next.js app for Prelegal. Every page except **Sign in** (`/signin`) and **Sign up**
(`/signup`) needs an account:

- **My documents** (`/`) lists the user's saved documents, to open, download as a PDF or delete.
- **Draft an agreement** (`/draft/?id=…`): the user chats with an AI assistant (or edits the
  fields in a form), which picks one of the 11 supported Common Paper agreements and fills it
  in, and sees the document update as they go. The draft is saved to their account
  automatically, and can be downloaded as a PDF.

The chat and the saved documents go through the backend's API; the preview and PDF are made
in the browser. Every document carries a disclaimer that it is a draft for legal review.

The app is exported as static files (`output: "export"` in `next.config.ts`), which the
FastAPI backend in `../backend` serves. Server-only Next.js features (route handlers,
server actions, rewrites, `next start`) are therefore not available; API endpoints belong
in the backend.

## Getting started

Requires Node.js 24.

```bash
npm install
npm run dev     # http://localhost:3000, without the API (see below)
npm test        # unit tests (Vitest)
npm run lint
npm run build   # static site in out/
```

`npm run dev` has no backend, so signing in and everything after it fails there. To use the
whole app, build it and run it through the backend (`npm run build`, then start the backend
as described in `../backend/README.md`) or with Docker.

## How it works

- **Accounts** (`src/components/auth/`): `AuthProvider` asks `GET /api/auth/me` once per page
  load and forgets the user whenever any request answers `401`. `AuthGate` shows each page only
  to the right visitors and redirects the others (`src/lib/auth/redirect.ts`): signed-out
  users go to `/signin/?next=…` and come back afterwards. Being a static export, this runs in
  the browser; the API is what protects the data. The session is an HttpOnly cookie that the
  scripts never see.
- **API requests** go through `apiRequest` (`src/lib/api.ts`), which turns failures into an
  `ApiError` with a message to show. Its `fetchImpl` parameter lets the tests fake the backend.
- **Saving**: a new draft gets a random id in its address (`/draft/?id=…`) and is saved under
  it with `PUT /api/documents/{id}` once the assistant has chosen the document, then after
  every change, a moment after the changes pause (`src/lib/documents/autosave.ts`, with one
  save at a time and the latest change always sent last). Reopening a document starts a new
  conversation; the assistant sees the saved values.
- **Templates and the catalog** are read from the repository's `templates/` directory and
  `documents.json` at build time (`src/lib/templates.ts`) and baked into the pages that need
  them (`/` and `/draft`), so they are the single source of truth. Builds must run with the whole repository checked out,
  not `frontend/` alone.
- **The catalog** (`src/lib/documents/catalog.ts`) describes each document's fields and
  works out defaults, validity and what is still missing. The backend applies the same rules.
- **Cover pages** (`src/lib/documents/coverPage.ts`): the Mutual NDA has an official cover
  page template, which `ndaCoverPage.ts` fills in; if that template changes so a placeholder
  is no longer found, it throws. The other templates hold only Standard Terms, so their cover
  page is generated from the fields, followed by a signature table. User input is escaped so
  it is always shown as plain text.
- **Parsing** (`src/lib/documents/document.ts`) turns the markdown into a small document
  model. References to cover page variables in the Standard Terms (e.g. *Purpose*,
  *Governing Law*) are kept as highlighted defined terms rather than substituted.
- **Rendering**: the same document model is rendered to HTML for the live preview
  (`DocumentView`) and to PDF with `@react-pdf/renderer` (`DocumentPdf`). The PDF code is
  loaded only when the user clicks **Download PDF**. Every PDF page has the draft disclaimer
  in its footer (`src/lib/legal.ts`).
- **Styling** uses the Prelegal palette, defined as Tailwind theme tokens in
  `src/app/globals.css` (`brand-yellow`, `brand-blue`, `brand-purple` for submit buttons,
  `brand-navy` for headings, `brand-gray` for secondary text). The document preview keeps the
  PDF's own colours so it matches the downloaded document. Shared buttons, inputs, the logo
  and loading states are in `src/components/ui.tsx`, and the signed-in pages' header and
  footer in `src/components/AppShell.tsx`.

The agreement text is © Common Paper, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see `templates/LICENSE.txt`.
