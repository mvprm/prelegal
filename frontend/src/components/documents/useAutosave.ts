import { useEffect, useRef, useState } from "react";
import { createAutosaver, type SaveStatus } from "@/lib/documents/autosave";
import type { Draft } from "@/lib/documents/chat";
import { saveDocument, type ChosenDraft } from "@/lib/documents/saved";

export interface AutosaveState {
  /** Null until there is anything to save, i.e. until a document has been chosen. */
  status: SaveStatus | null;
  /** Saves again after a failed save. */
  retry: () => void;
}

/**
 * Saves the draft to the user's account as document `id` whenever it changes, once a
 * document has been chosen. `initial` is the draft as loaded, which needs no saving.
 */
export function useAutosave(id: string, draft: Draft, initial: Draft): AutosaveState {
  const [status, setStatus] = useState<SaveStatus | null>(initial.documentId ? "saved" : null);
  const [saver] = useState(() =>
    createAutosaver<ChosenDraft>((chosen, options) => saveDocument(id, chosen, options), setStatus),
  );
  // Chat replies replace the draft even when nothing in it changed, so compare contents.
  const lastScheduled = useRef(JSON.stringify(initial));

  useEffect(() => {
    const { documentId, values } = draft;
    if (documentId === null) return;
    const json = JSON.stringify(draft);
    if (json === lastScheduled.current) return;
    lastScheduled.current = json;
    saver.schedule({ documentId, values });
  }, [draft, saver]);

  // Send the last change straight away when leaving, rather than after the usual pause.
  useEffect(() => {
    const flushOnHide = () => saver.flush({ keepalive: true });
    window.addEventListener("pagehide", flushOnHide);
    return () => {
      window.removeEventListener("pagehide", flushOnHide);
      saver.flush();
    };
  }, [saver]);

  return { status, retry: () => saver.flush() };
}
