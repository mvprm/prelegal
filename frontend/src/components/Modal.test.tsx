// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import { ConfirmDialog, Modal } from "./Modal";
import { destructiveButton, primaryButton } from "./ui";

/** Esc, as far as the page can tell: browsers fire `cancel` on the dialog, which jsdom does not. */
function pressEscape(dialog: HTMLElement): boolean {
  return fireEvent(dialog, new Event("cancel", { cancelable: true }));
}

function renderModal(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn();
  const view = render(
    <Modal open title="Rename document" description="Give it a name." onClose={onClose} footer={<button type="button">Save</button>} {...props}>
      <input aria-label="Name" />
    </Modal>,
  );
  return { ...view, onClose };
}

describe("Modal", () => {
  it("shows nothing while closed", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Rename document")).toBeNull();
  });

  it("opens as a dialog named by its title and described by its description", () => {
    renderModal();
    const dialog = screen.getByRole("dialog", { name: "Rename document", description: "Give it a name." });
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("closes when the parent says so, and starts afresh when opened again", async () => {
    const { rerender, onClose } = renderModal();
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Acme NDA");

    const modal = (open: boolean) => (
      <Modal open={open} title="Rename document" onClose={onClose} footer={null}>
        <input aria-label="Name" />
      </Modal>
    );
    rerender(modal(false));
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(modal(true));
    expect((screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value).toBe("");
  });

  it("asks to close on Esc, leaving the decision to the parent", () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog");
    expect(pressEscape(dialog)).toBe(false); // the browser's own closing is prevented
    expect(onClose).toHaveBeenCalledOnce();
    expect((dialog as HTMLDialogElement).open).toBe(true);
  });

  it("asks to close on a click on the backdrop, but not inside the card", () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog");

    fireEvent.mouseDown(screen.getByRole("heading"));
    fireEvent.click(screen.getByRole("heading"));
    // Selecting text in the input and letting go over the backdrop.
    fireEvent.mouseDown(screen.getByRole("textbox"));
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open on Esc or the backdrop while it cannot be dismissed", () => {
    const { onClose } = renderModal({ dismissible: false });
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;

    pressEscape(dialog);
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.open).toBe(true);
  });

  // Browsers close a dialog themselves on a second Esc in a row, without a `cancel` to prevent.
  it("keeps the parent in step when the browser closes it", () => {
    const { onClose } = renderModal();
    act(() => (screen.getByRole("dialog") as HTMLDialogElement).close());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("reopens when the browser closes it while it cannot be dismissed", () => {
    const { onClose } = renderModal({ dismissible: false });
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    act(() => dialog.close());
    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focuses the element marked data-autofocus", () => {
    renderModal({ footer: <button type="button" data-autofocus>Save</button> });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
  });
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderConfirm(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn(async () => {});
  const onClose = vi.fn();
  const element = (open: boolean) => (
    <ConfirmDialog
      open={open}
      title="Delete “Acme NDA”?"
      description="This cannot be undone."
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      destructive
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />
  );
  const view = render(element(true));
  function reopen() {
    view.rerender(element(false));
    view.rerender(element(true));
  }
  return { ...view, onConfirm, onClose, reopen };
}

describe("ConfirmDialog", () => {
  it("asks with a red button, and focuses Cancel so Enter does not delete", () => {
    renderConfirm();
    expect(screen.getByRole("dialog", { name: "Delete “Acme NDA”?", description: "This cannot be undone." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" }).className).toBe(destructiveButton);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("focuses the confirm button when the action is not destructive", () => {
    renderConfirm({ destructive: false, confirmLabel: "Continue" });
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button.className).toBe(primaryButton);
    expect(document.activeElement).toBe(button);
  });

  it("does the action, then closes", async () => {
    const { onConfirm, onClose } = renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cancels without doing the action, with the button or Esc", async () => {
    const { onConfirm, onClose } = renderConfirm();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    pressEscape(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cannot be cancelled while the action runs", async () => {
    const action = deferred();
    const { onClose } = renderConfirm({ onConfirm: () => action.promise });

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const pending = screen.getByRole("button", { name: "Deleting…" }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    pressEscape(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => action.resolve());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open and says why when the action fails, so the user can try again", async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new ApiError(404, "Document not found")).mockResolvedValueOnce(undefined);
    const { onClose } = renderConfirm({ onConfirm });

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alert").textContent).toBe("Document not found");
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a generic message for an unexpected failure, and forgets it once closed", async () => {
    const { reopen } = renderConfirm({ onConfirm: vi.fn().mockRejectedValue(new TypeError("boom")) });

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alert").textContent).toBe(GENERIC_ERROR);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    reopen();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
