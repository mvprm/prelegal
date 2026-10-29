import { describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../testing";
import { deleteDocument, getDocument, listDocuments, newDocumentId, partiesLabel, saveDocument } from "./saved";

const ID = "3f2c5a9e-8d4b-4c1a-9e7f-0a1b2c3d4e5f";
const saved = {
  id: ID,
  documentId: "mutual-nda",
  values: { purpose: "Evaluation" },
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:05:00.000Z",
};

describe("saved document requests", () => {
  it("lists and gets documents", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (url) => jsonResponse(200, url === "/api/documents" ? [saved] : saved));
    expect(await listDocuments(fetchImpl)).toEqual([saved]);
    expect(await getDocument(ID, fetchImpl)).toEqual(saved);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(["/api/documents", `/api/documents/${ID}`]);
  });

  it("saves the draft with PUT, under its id", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, saved));

    await saveDocument(ID, { documentId: "mutual-nda", values: { purpose: "Evaluation" } }, { keepalive: true, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`/api/documents/${ID}`);
    expect(init).toMatchObject({ method: "PUT", keepalive: true });
    expect(JSON.parse(init?.body as string)).toEqual({ documentId: "mutual-nda", values: { purpose: "Evaluation" } });
  });

  it("deletes a document", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    await deleteDocument(ID, fetchImpl);
    expect(fetchImpl.mock.calls[0]).toMatchObject([`/api/documents/${ID}`, { method: "DELETE" }]);
  });

  it("escapes ids in the URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, saved));
    await getDocument("../auth/me", fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/documents/..%2Fauth%2Fme");
  });
});

describe("newDocumentId", () => {
  it("makes version 4 UUIDs", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const ids = Array.from({ length: 20 }, () => newDocumentId());
    for (const id of ids) expect(id).toMatch(uuid);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sets the version and variant bits whatever the random bytes", () => {
    expect(newDocumentId((bytes) => bytes.fill(0xff))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(newDocumentId((bytes) => bytes.fill(0))).toBe("00000000-0000-4000-8000-000000000000");
  });
});

describe("partiesLabel", () => {
  it("names the parties that are filled in", () => {
    expect(partiesLabel({ "party1.company": "Acme Inc", "party2.company": "Globex LLC" })).toBe("Acme Inc and Globex LLC");
    expect(partiesLabel({ "party1.company": " ", "party2.company": "Globex LLC" })).toBe("Globex LLC");
    expect(partiesLabel({})).toBeNull();
  });
});
