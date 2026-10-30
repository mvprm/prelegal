"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { defaultValues, findDocument, missingFields, type DocumentSpec } from "@/lib/documents/catalog";
import { GREETING, type ChatMessage, type Draft } from "@/lib/documents/chat";
import { buildCoverPage } from "@/lib/documents/coverPage";
import { parseDocument } from "@/lib/documents/document";
import { documentName } from "@/lib/documents/saved";
import { DRAFT_DISCLAIMER } from "@/lib/legal";
import { primaryButton } from "../ui";
import { Chat } from "./Chat";
import { DocumentForm } from "./DocumentForm";
import { DocumentView } from "./DocumentView";
import { downloadDocumentPdf } from "./download";
import { useAutosave, type AutosaveState } from "./useAutosave";
import { useDraftChat } from "./useDraftChat";

interface DraftCreatorProps {
  catalog: DocumentSpec[];
  /** Raw markdown of every template the catalog refers to, by filename. */
  templates: Record<string, string>;
  /** The id the draft is saved under in the user's account. */
  id: string;
  /** The draft as saved, when reopening a document; otherwise an empty draft. */
  initialDraft: Draft;
  /** The name the user gave the document on My documents, if any. */
  title: string | null;
}

/**
 * Drafting a document: the chat (or the form) on one side, the live preview on the other.
 * The assistant picks the document from the conversation; until then there is no preview.
 * From then on every change is saved to the user's account.
 */
export function DraftCreator({ catalog, templates, id, initialDraft, title }: DraftCreatorProps) {
  const today = useToday();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const spec = findDocument(catalog, draft.documentId);
  const [greeting] = useState(() => greetingFor(findDocument(catalog, initialDraft.documentId)));
  const chat = useDraftChat(draft, today, setDraft, greeting);
  const autosave = useAutosave(id, draft, initialDraft);
  const [tab, setTab] = useState<Tab>("chat");

  /**
   * Chooses the document from the list rather than through the chat. The assistant is told,
   * as if the user had written it, so it carries on with the first questions about it.
   */
  function chooseDocument(chosen: DocumentSpec) {
    const next: Draft = { documentId: chosen.id, values: defaultValues(chosen, today) };
    setDraft(next);
    chat.send(`I'd like to draft a ${chosen.name}.`, next);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-10">
      <section aria-label="Document details" className="min-w-0">
        <Tabs selected={tab} onSelect={setTab} formAvailable={spec !== null} />
        {/* Both panels stay mounted, so switching tabs keeps the conversation and its scroll position. */}
        <div id={panelId("chat")} role="tabpanel" aria-labelledby={tabId("chat")} hidden={tab !== "chat"}>
          <Chat chat={chat} ready={today !== ""} />
        </div>
        <div id={panelId("form")} role="tabpanel" aria-labelledby={tabId("form")} hidden={tab !== "form"}>
          {spec && (
            // Locked while the assistant replies, since its reply replaces the values it was sent.
            <DocumentForm
              spec={spec}
              values={draft.values}
              onChange={(values) => setDraft({ ...draft, values })}
              disabled={chat.pending}
            />
          )}
        </div>
      </section>

      {spec ? (
        <Preview spec={spec} title={title} draft={draft} templates={templates} autosave={autosave} />
      ) : (
        <Placeholder catalog={catalog} onChoose={chooseDocument} disabled={today === "" || chat.pending} />
      )}
    </div>
  );
}

/** The assistant's first message: an opening question, or for a saved document, where it stands. */
function greetingFor(spec: DocumentSpec | null): ChatMessage {
  if (!spec) return GREETING;
  return {
    role: "assistant",
    content: `Welcome back! We're working on your ${spec.name}. What would you like to fill in or change?`,
  };
}

function Preview({
  spec,
  title,
  draft,
  templates,
  autosave,
}: {
  spec: DocumentSpec;
  title: string | null;
  draft: Draft;
  templates: Record<string, string>;
  autosave: AutosaveState;
}) {
  const coverPage = parseDocument(
    buildCoverPage(spec, draft.values, spec.coverPageTemplate && templates[spec.coverPageTemplate]),
  );
  // The Standard Terms never change, so they are parsed once per document.
  const standardTerms = useMemo(() => parseDocument(templates[spec.standardTerms]), [templates, spec]);
  const missing = missingFields(spec, draft.values);

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      await downloadDocumentPdf(spec, draft.values, templates, title);
    } catch (e) {
      console.error(e);
      setError("Sorry, the PDF could not be created. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-labelledby="preview-heading" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="preview-heading" className="text-base font-semibold text-brand-navy">
            {documentName(title, spec.name)}
          </h2>
          {title && <span className="text-sm text-brand-gray">{spec.name}</span>}
          <SaveIndicator autosave={autosave} />
        </div>
        <button type="button" onClick={handleDownload} disabled={missing.length > 0 || downloading} className={primaryButton}>
          {downloading ? "Preparing PDF…" : "Download PDF"}
        </button>
      </div>

      <p className="rounded-md border border-brand-blue/30 bg-brand-blue/5 px-3 py-2 text-sm text-brand-navy">
        <strong className="font-semibold">Draft for legal review.</strong> {DRAFT_DISCLAIMER}
      </p>

      {missing.length > 0 && (
        <p className="rounded-md border-l-4 border-brand-yellow bg-brand-yellow/10 px-3 py-2 text-sm text-brand-navy">
          To download, fill in: {missing.join(", ")}.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Styled like the printed page, so it keeps the PDF's colours rather than the brand palette. */}
      <article className="rounded-lg border border-neutral-200 bg-white px-6 py-8 text-neutral-900 shadow-sm sm:px-10 sm:py-12">
        <DocumentView blocks={coverPage} />
        <hr className="my-10 border-dashed border-neutral-300" />
        <DocumentView blocks={standardTerms} />
      </article>
    </section>
  );
}

/** Shown until a document is chosen: what can be drafted, to choose from directly. */
function Placeholder({
  catalog,
  onChoose,
  disabled,
}: {
  catalog: DocumentSpec[];
  onChoose: (spec: DocumentSpec) => void;
  /** While the page loads or the assistant is replying. */
  disabled: boolean;
}) {
  return (
    <section aria-labelledby="documents-heading" className="min-w-0 space-y-4">
      <h2 id="documents-heading" className="text-base font-semibold text-brand-navy">
        Choose a document
      </h2>
      <p className="text-sm text-brand-gray">
        Pick the agreement you need, or tell the assistant about your situation and it will suggest
        the right one. The preview appears here.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {catalog.map((spec) => (
          <li key={spec.id}>
            <button
              type="button"
              onClick={() => onChoose(spec)}
              disabled={disabled}
              className="group flex h-full w-full flex-col rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-blue hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-neutral-200 disabled:hover:shadow-sm"
            >
              <span className="font-semibold text-brand-navy">{spec.name}</span>
              <span className="mt-1 flex-1 text-sm text-brand-gray">{spec.description}</span>
              <span className="mt-3 text-sm font-semibold text-brand-blue group-hover:underline group-disabled:no-underline">
                Draft this agreement →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Tab = "chat" | "form";

const tabs: { value: Tab; label: string }[] = [
  { value: "chat", label: "Chat with AI" },
  { value: "form", label: "Edit fields" },
];

const tabId = (tab: Tab) => `draft-tab-${tab}`;
const panelId = (tab: Tab) => `draft-panel-${tab}`;

/** The form tab is disabled until the assistant has chosen a document. */
function Tabs({
  selected,
  onSelect,
  formAvailable,
}: {
  selected: Tab;
  onSelect: (tab: Tab) => void;
  formAvailable: boolean;
}) {
  return (
    <div role="tablist" aria-label="How to fill in the document" className="mb-4 flex gap-1 border-b border-neutral-200">
      {tabs.map(({ value, label }) => {
        const isSelected = value === selected;
        const unavailable = value === "form" && !formAvailable;
        return (
          <button
            key={value}
            id={tabId(value)}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-controls={panelId(value)}
            disabled={unavailable}
            title={unavailable ? "Available once a document is chosen" : undefined}
            onClick={() => onSelect(value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected
                ? "border-brand-blue text-brand-navy"
                : "border-transparent text-brand-gray hover:text-brand-navy"
            }`}
          >
            {label}
          </button>
        );
      })}
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

/** Whether the latest changes are saved to the user's account. */
function SaveIndicator({ autosave: { status, retry } }: { autosave: AutosaveState }) {
  if (status === null) return null;
  if (status === "error") {
    return (
      <span role="alert" className="text-xs text-red-700">
        Not saved.{" "}
        <button type="button" onClick={retry} className="font-semibold underline hover:no-underline">
          Try again
        </button>
      </span>
    );
  }
  return (
    <span role="status" className="text-xs text-brand-gray">
      {status === "saving" ? "Saving…" : "Saved to My documents"}
    </span>
  );
}
