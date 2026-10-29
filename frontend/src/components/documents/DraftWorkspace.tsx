"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import type { DocumentSpec } from "@/lib/documents/catalog";
import type { Draft } from "@/lib/documents/chat";
import { getDocument, newDocumentId } from "@/lib/documents/saved";
import { ErrorMessage, PageLoading, secondaryButton } from "../ui";
import { DraftCreator } from "./DraftCreator";

interface DraftWorkspaceProps {
  catalog: DocumentSpec[];
  templates: Record<string, string>;
}

/**
 * The draft at `/draft/?id=…`. A new draft first gets an id in the address, so it is saved
 * under that id and the page can be reloaded or bookmarked. The document is always loaded
 * from the account, and an id with nothing saved yet opens as a new draft.
 */
export function DraftWorkspace({ catalog, templates }: DraftWorkspaceProps) {
  const id = useSearchParams().get("id");
  const router = useRouter();

  useEffect(() => {
    if (!id) router.replace(`/draft/?id=${newDocumentId()}`);
  }, [id, router]);

  // Keyed by id, so "New document" (which drops the id) starts over with a fresh chat.
  return id ? <SavedDraft key={id} id={id} catalog={catalog} templates={templates} /> : <PageLoading />;
}

const NEW_DRAFT: Draft = { documentId: null, values: {} };

type Loaded = { status: "loading" } | { status: "ready"; draft: Draft } | { status: "failed"; message: string };

function SavedDraft({ id, catalog, templates }: DraftWorkspaceProps & { id: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Loaded every time, even for a draft started moments ago in this tab: by now it may have
  // been saved, and showing it as empty would lose (and could overwrite) what was saved.
  useEffect(() => {
    let current = true;
    getDocument(id).then(
      ({ documentId, values }) => current && setLoaded({ status: "ready", draft: { documentId, values } }),
      (e) => {
        if (!current) return;
        if (e instanceof ApiError && e.status === 404) {
          setLoaded({ status: "ready", draft: NEW_DRAFT });
        } else {
          setLoaded({ status: "failed", message: e instanceof ApiError ? e.message : GENERIC_ERROR });
        }
      },
    );
    return () => {
      current = false;
    };
  }, [id, attempt]);

  switch (loaded.status) {
    case "loading":
      return <PageLoading label="Opening your document…" />;
    case "failed":
      return (
        <div className="mx-auto max-w-md space-y-4 py-16">
          <ErrorMessage>This document could not be opened. {loaded.message}</ErrorMessage>
          <div className="flex gap-3">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setLoaded({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
            <Link href="/" className={secondaryButton}>
              Back to My documents
            </Link>
          </div>
        </div>
      );
    case "ready":
      return <DraftCreator catalog={catalog} templates={templates} id={id} initialDraft={loaded.draft} />;
  }
}
