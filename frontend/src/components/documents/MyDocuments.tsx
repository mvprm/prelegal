"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { findDocument, missingFields, type DocumentSpec } from "@/lib/documents/catalog";
import { deleteDocument, listDocuments, partiesLabel, type SavedDocument } from "@/lib/documents/saved";
import { ConfirmDialog } from "../Modal";
import { ErrorMessage, PageLoading, primaryButton, secondaryButton } from "../ui";
import { downloadDocumentPdf } from "./download";

interface MyDocumentsProps {
  catalog: DocumentSpec[];
  templates: Record<string, string>;
}

type Listing = { status: "loading" } | { status: "ready"; documents: SavedDocument[] } | { status: "failed"; message: string };

/** The signed-in user's saved documents, to open, download or delete. */
export function MyDocuments({ catalog, templates }: MyDocumentsProps) {
  const [listing, setListing] = useState<Listing>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  /** The document the user asked to delete, until they confirm or cancel. */
  const [toDelete, setToDelete] = useState<{ document: SavedDocument; title: string } | null>(null);

  useEffect(() => {
    let current = true;
    listDocuments().then(
      (documents) => current && setListing({ status: "ready", documents }),
      (e) => current && setListing({ status: "failed", message: errorMessage(e) }),
    );
    return () => {
      current = false;
    };
  }, []);

  /** Deletes the document once confirmed. A failure is shown in the dialog, which stays open. */
  async function remove(document: SavedDocument) {
    await deleteDocument(document.id);
    setListing((listing) =>
      listing.status === "ready"
        ? { status: "ready", documents: listing.documents.filter(({ id }) => id !== document.id) }
        : listing,
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">My documents</h1>
          <p className="text-brand-gray">Your drafts are saved here as you work on them.</p>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {listing.status === "loading" && <PageLoading label="Loading your documents…" />}
      {listing.status === "failed" && <ErrorMessage>Your documents could not be loaded. {listing.message}</ErrorMessage>}
      {listing.status === "ready" &&
        (listing.documents.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            {listing.documents.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                spec={findDocument(catalog, document.documentId)}
                templates={templates}
                onDelete={(document, title) => setToDelete({ document, title })}
                onError={setError}
              />
            ))}
          </ul>
        ))}

      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete ? `Delete “${toDelete.title}”?` : ""}
        description="It will be removed from My documents for good. This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        destructive
        onConfirm={async () => {
          if (toDelete) await remove(toDelete.document);
        }}
        onClose={() => setToDelete(null)}
      />
    </main>
  );
}

function DocumentRow({
  document,
  spec,
  templates,
  onDelete,
  onError,
}: {
  document: SavedDocument;
  spec: DocumentSpec | null;
  templates: Record<string, string>;
  onDelete: (document: SavedDocument, title: string) => void;
  onError: (message: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const title = spec?.name ?? document.documentId;
  const missing = spec ? missingFields(spec, document.values) : [];
  const href = `/draft/?id=${document.id}`;

  async function download() {
    if (!spec) return;
    setDownloading(true);
    try {
      await downloadDocumentPdf(spec, document.values, templates);
    } catch (e) {
      console.error(e);
      onError(`The PDF of “${title}” could not be created. Please try again.`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className="font-semibold text-brand-navy hover:text-brand-blue hover:underline">
            {title}
          </Link>
          {missing.length === 0 ? (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800 ring-1 ring-green-600/20">
              Ready to download
            </span>
          ) : (
            <span className="rounded-full bg-brand-yellow/10 px-2 py-0.5 text-xs font-medium text-brand-navy ring-1 ring-brand-yellow/40">
              {missing.length} {missing.length === 1 ? "field" : "fields"} to complete
            </span>
          )}
        </div>
        <p className="truncate text-sm text-brand-gray">
          {partiesLabel(document.values) ?? "Parties not named yet"} · Updated {formatTimestamp(document.updatedAt)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href={href} className={secondaryButton}>
          Open
        </Link>
        <button
          type="button"
          onClick={download}
          disabled={!spec || missing.length > 0 || downloading}
          title={missing.length > 0 ? `To download, fill in: ${missing.join(", ")}` : undefined}
          className={secondaryButton}
        >
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(document, title)}
          className={`${secondaryButton} text-red-700 hover:bg-red-50`}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10 text-brand-blue" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
      </svg>
      <div className="space-y-1">
        <h2 className="font-semibold text-brand-navy">No documents yet</h2>
        <p className="text-sm text-brand-gray">
          Tell our AI assistant what you need, and your draft will appear here.
        </p>
      </div>
      <Link href="/draft/" className={primaryButton}>
        Draft your first agreement
      </Link>
    </div>
  );
}

/** e.g. "28 Oct 2026, 14:03", in the user's locale and time zone. */
function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
