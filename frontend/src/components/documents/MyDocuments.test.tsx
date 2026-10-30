// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { deleteDocument, listDocuments, renameDocument, type SavedDocument } from "@/lib/documents/saved";
import { readCatalog } from "@/lib/templates";
import { MyDocuments } from "./MyDocuments";

vi.mock("@/lib/documents/saved", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/documents/saved")>()),
  listDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  renameDocument: vi.fn(),
}));
vi.mock("./download", () => ({ downloadDocumentPdf: vi.fn() }));

const catalog = readCatalog();

const nda: SavedDocument = {
  id: "3f2c5a9e-8d4b-4c1a-9e7f-0a1b2c3d4e5f",
  documentId: "mutual-nda",
  values: { "party1.company": "Acme Inc", "party2.company": "Globex LLC" },
  title: null,
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:05:00.000Z",
};

beforeEach(() => {
  vi.mocked(listDocuments).mockReset().mockResolvedValue([nda]);
  vi.mocked(deleteDocument).mockReset().mockResolvedValue(undefined);
  vi.mocked(renameDocument)
    .mockReset()
    .mockImplementation(async (id, title) => ({ ...nda, id, title: title.trim() || null }));
});

/** The line under the document's name: its kind (once renamed), parties and last update. */
function details(): string {
  return screen.getByText(/Updated/).textContent ?? "";
}

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

describe("renaming a document", () => {
  /** Shows the list and opens the rename dialog; returns its name box. */
  async function openRename(document: SavedDocument = nda) {
    vi.mocked(listDocuments).mockResolvedValue([document]);
    render(<MyDocuments catalog={catalog} templates={{}} />);
    await userEvent.click(await screen.findByRole("button", { name: "Rename" }));
    return within(screen.getByRole("dialog", { name: "Rename document" })).getByRole("textbox", { name: "Name" });
  }

  it("names it, keeping its kind of document in the details", async () => {
    const input = (await openRename()) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Mutual Non-Disclosure Agreement");
    expect(input.maxLength).toBe(120);
    expect(document.activeElement).toBe(input);

    await userEvent.type(input, "Q3 NDA{Enter}");

    expect(renameDocument).toHaveBeenCalledWith(nda.id, "Q3 NDA");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("link", { name: "Q3 NDA" })).toBeTruthy();
    expect(details()).toMatch(/^Mutual Non-Disclosure Agreement · Acme Inc and Globex LLC · Updated/);
  });

  it("goes back to the default name when the box is cleared", async () => {
    const input = await openRename({ ...nda, title: "Q3 NDA" });
    expect((input as HTMLInputElement).value).toBe("Q3 NDA");

    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(renameDocument).toHaveBeenCalledWith(nda.id, "");
    expect(await screen.findByRole("link", { name: "Mutual Non-Disclosure Agreement" })).toBeTruthy();
    expect(details()).toMatch(/^Acme Inc and Globex LLC · Updated/);
  });

  it("sends nothing when the name is unchanged", async () => {
    await openRename({ ...nda, title: "Q3 NDA" });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(renameDocument).not.toHaveBeenCalled();
  });

  it("says why in the dialog when it fails, and keeps the old name", async () => {
    vi.mocked(renameDocument).mockRejectedValue(new ApiError(422, "The name can be at most 120 characters long."));
    const input = await openRename();
    await userEvent.type(input, "Q3 NDA{Enter}");

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toBe("The name can be at most 120 characters long.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("link", { name: "Mutual Non-Disclosure Agreement" })).toBeTruthy();
  });

  it("uses the new name when deleting", async () => {
    await openRename({ ...nda, title: "Q3 NDA" });
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete “Q3 NDA”?" })).toBeTruthy();
  });
});
