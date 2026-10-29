# Prelegal frontend

Next.js app for Prelegal. Its main page is **Draft an agreement** at `/draft`. The user
chats with an AI assistant (or edits the fields in a form), which picks one of the 11
supported Common Paper agreements and fills it in, sees the document update as they go, and
downloads it as a PDF. The chat runs through the backend's `POST /api/chat`; the preview and
PDF are made in the browser. There are also placeholder **Sign in** and **Sign up** pages
(`/signin`, `/signup`) that do not create accounts yet.

The app is exported as static files (`output: "export"` in `next.config.ts`), which the
FastAPI backend in `../backend` serves. Server-only Next.js features (route handlers,
server actions, rewrites, `next start`) are therefore not available; API endpoints belong
in the backend.

## Getting started

Requires Node.js 24.

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests (Vitest)
npm run lint
npm run build   # static site in out/
```

## How it works

- **Templates and the catalog** are read from the repository's `templates/` directory and
  `documents.json` at build time (`src/lib/templates.ts`) and baked into the page, so they
  are the single source of truth. Builds must run with the whole repository checked out,
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
  loaded only when the user clicks **Download PDF**.
- **Styling** uses the Prelegal palette, defined as Tailwind theme tokens in
  `src/app/globals.css` (`brand-yellow`, `brand-blue`, `brand-purple` for submit buttons,
  `brand-navy` for headings, `brand-gray` for secondary text). The document preview keeps the
  PDF's own colours so it matches the downloaded document.

The agreement text is © Common Paper, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see `templates/LICENSE.txt`.
