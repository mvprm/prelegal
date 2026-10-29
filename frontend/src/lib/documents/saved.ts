import { apiRequest } from "../api";
import type { Values } from "./catalog";
import type { Draft } from "./chat";

/** A document in the user's account (`SavedDocument` in backend/app/api/documents.py). */
export interface SavedDocument {
  id: string;
  /** The kind of document, an id from documents.json. */
  documentId: string;
  values: Values;
  createdAt: string;
  updatedAt: string;
}

/** A draft whose document has been chosen, so it can be saved. */
export type ChosenDraft = Draft & { documentId: string };

export function listDocuments(fetchImpl?: typeof fetch): Promise<SavedDocument[]> {
  return apiRequest<SavedDocument[]>("/documents", { fetchImpl });
}

export function getDocument(id: string, fetchImpl?: typeof fetch): Promise<SavedDocument> {
  return apiRequest<SavedDocument>(`/documents/${encodeURIComponent(id)}`, { fetchImpl });
}

/** Creates the document with this id, or replaces its contents. Repeating it is harmless. */
export function saveDocument(
  id: string,
  draft: ChosenDraft,
  options: { keepalive?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<SavedDocument> {
  return apiRequest<SavedDocument>(`/documents/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { documentId: draft.documentId, values: draft.values },
    ...options,
  });
}

export function deleteDocument(id: string, fetchImpl?: typeof fetch): Promise<void> {
  return apiRequest<void>(`/documents/${encodeURIComponent(id)}`, { method: "DELETE", fetchImpl });
}

/**
 * A new document id: a random (version 4) UUID. Made with `getRandomValues` rather than
 * `crypto.randomUUID()`, which browsers offer only on HTTPS and localhost.
 */
export function newDocumentId(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** "Acme Inc and Globex LLC", from whichever party names are filled in, or null if neither is. */
export function partiesLabel(values: Values): string | null {
  const names = [values["party1.company"], values["party2.company"]].map((name) => name?.trim()).filter(Boolean);
  return names.length > 0 ? names.join(" and ") : null;
}
