"use client";

import { useState, useSyncExternalStore } from "react";
import { parseDocument, type Block } from "@/lib/nda/document";
import { defaultFields, missingFields, pdfFileName, type NdaFields } from "@/lib/nda/fields";
import { fillCoverPage } from "@/lib/nda/fill";
import { DocumentView } from "./DocumentView";
import { NdaForm } from "./NdaForm";

interface NdaCreatorProps {
  /** Raw markdown of the cover page template, filled in as the user types. */
  coverPageTemplate: string;
  /** The Standard Terms never change, so they arrive already parsed. */
  standardTerms: Block[];
}

export function NdaCreator({ coverPageTemplate, standardTerms }: NdaCreatorProps) {
  const today = useToday();
  const [fields, setFields] = useState<NdaFields>(defaultFields);
  // The effective date defaults to today until the user picks one.
  const [dateEdited, setDateEdited] = useState(false);
  const current = dateEdited ? fields : { ...fields, effectiveDate: today };

  const coverPage = parseDocument(fillCoverPage(coverPageTemplate, current));
  const missing = missingFields(current);

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: NdaFields) {
    if (next.effectiveDate !== current.effectiveDate) setDateEdited(true);
    setFields(next);
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const { renderNdaPdf } = await import("./NdaPdf");
      const blob = await renderNdaPdf([coverPage, standardTerms]);
      saveFile(blob, pdfFileName(current));
    } catch (e) {
      console.error(e);
      setError("Sorry, the PDF could not be created. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-10">
      <section aria-label="NDA details">
        <NdaForm fields={current} onChange={handleChange} />
      </section>

      <section aria-labelledby="preview-heading" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="preview-heading" className="text-base font-semibold">
            Preview
          </h2>
          <button
            type="button"
            onClick={handleDownload}
            disabled={missing.length > 0 || downloading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-neutral-400 dark:disabled:bg-neutral-700"
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>

        {missing.length > 0 && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            To download, fill in: {missing.join(", ")}.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-100">
            {error}
          </p>
        )}

        {/* Always light, like the printed page, even in dark mode. */}
        <article className="rounded-lg border border-neutral-200 bg-white px-6 py-8 text-neutral-900 shadow-sm sm:px-10 sm:py-12 dark:border-neutral-800">
          <DocumentView blocks={coverPage} />
          <hr className="my-10 border-dashed border-neutral-300" />
          <DocumentView blocks={standardTerms} />
        </article>
      </section>
    </div>
  );
}

const subscribeNever = () => () => {};

/**
 * Today's local date as YYYY-MM-DD. Empty during prerendering and hydration, so the
 * build never bakes in its own date and the server and client HTML always match.
 */
function useToday(): string {
  return useSyncExternalStore(subscribeNever, localIsoDate, () => "");
}

function localIsoDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
