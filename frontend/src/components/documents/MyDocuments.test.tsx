// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { deleteDocument, listDocuments, type SavedDocument } from "@/lib/documents/saved";
import { readCatalog } from "@/lib/templates";
import { MyDocuments } from "./MyDocuments";

vi.mock("@/lib/documents/saved", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/documents/saved")>()),
  listDocuments: vi.fn(),
  deleteDocument: vi.fn(),
}));
vi.mock("./download", () => ({ downloadDocumentPdf: vi.fn() }));

const catalog = readCatalog();

const nda: SavedDocument = {
  id: "3f2c5a9e-8d4b-4c1a-9e7f-0a1b2c3d4e5f",
  documentId: "mutual-nda",
  values: { "party1.company": "Acme Inc", "party2.company": "Globex LLC" },
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:05:00.000Z",
};

beforeEach(() => {
  vi.mocked(listDocuments).mockReset().mockResolvedValue([nda]);
  vi.mocked(deleteDocument).mockReset().mockResolvedValue(undefined);
});

/** Shows the list and asks to delete the NDA; returns the confirmation dialog. */
async function askToDelete() {
  render(<MyDocuments catalog={catalog} templates={{}} />);
  await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
  return screen.getByRole("dialog", { name: "Delete “Mutual Non-Disclosure Agreement”?" });
}

describe("deleting a document", () => {
  it("asks in a dialog, rather than the browser's confirm box, and keeps it when cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const dialog = await askToDelete();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Acme Inc and Globex LLC", { exact: false })).toBeTruthy();
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("deletes it once confirmed", async () => {
    const dialog = await askToDelete();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(deleteDocument).toHaveBeenCalledWith(nda.id);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("No documents yet")).toBeTruthy();
  });

  it("says why in the dialog when it fails, and keeps the document", async () => {
    vi.mocked(deleteDocument).mockRejectedValue(new ApiError(0, "Could not reach Prelegal."));
    const dialog = await askToDelete();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(within(dialog).getByRole("alert").textContent).toBe("Could not reach Prelegal.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Acme Inc and Globex LLC", { exact: false })).toBeTruthy();
  });
});
