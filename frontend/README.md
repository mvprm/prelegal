# Prelegal frontend

Next.js app for Prelegal. It currently contains the **Mutual NDA Creator** at `/nda`:
the user fills in a form, sees the Common Paper Mutual NDA with their details filled in,
and downloads it as a PDF. The NDA creator runs entirely in the browser. There are also
placeholder **Sign in** and **Sign up** pages (`/signin`, `/signup`) that do not create
accounts yet.

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

- **Templates** are read from the repository's `templates/` directory at build time
  (`src/lib/templates.ts`), so `templates/` is the single source of truth for agreement
  text. Builds must run with the whole repository checked out, not `frontend/` alone.
- **Filling** (`src/lib/nda/fill.ts`) replaces the cover page placeholders with the
  user's answers. User input is escaped so it is always shown as plain text. If the
  upstream template changes so a placeholder is no longer found, it throws, failing the
  build and the tests instead of silently leaving a field blank.
- **Parsing** (`src/lib/nda/document.ts`) turns the markdown into a small document model.
  References to cover page variables in the Standard Terms (e.g. *Purpose*,
  *Governing Law*) are kept as highlighted defined terms rather than substituted.
- **Rendering**: the same document model is rendered to HTML for the live preview
  (`DocumentView`) and to PDF with `@react-pdf/renderer` (`NdaPdf`). The PDF code is
  loaded only when the user clicks **Download PDF**.
- **Styling** uses the Prelegal palette, defined as Tailwind theme tokens in
  `src/app/globals.css` (`brand-yellow`, `brand-blue`, `brand-purple` for submit buttons,
  `brand-navy` for headings, `brand-gray` for secondary text). The NDA preview keeps the
  PDF's own colours so it matches the downloaded document.

The agreement text is © Common Paper, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see `templates/LICENSE.txt`.
