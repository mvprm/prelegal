"use client";

import { useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import { destructiveButton, ErrorMessage, primaryButton, secondaryButton } from "./ui";

interface ModalProps {
  open: boolean;
  /** Asks to close it (Esc or a click on the backdrop); the parent then sets `open` to false. */
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  /** The body, e.g. a form. Rendered only while open, so its state starts afresh each time. */
  children?: React.ReactNode;
  /** The buttons, at the bottom right. */
  footer: React.ReactNode;
  /** False while something runs, so Esc and the backdrop leave it open. */
  dismissible?: boolean;
}

/**
 * A dialog over the page, on the browser's own `<dialog>`: while open, the page behind it
 * is inert and Tab stays inside it. It focuses the element marked `data-autofocus`, if any
 * (otherwise the first one that can be focused), and focus goes back where it was on closing.
 */
export function Modal({ open, onClose, title, description, children, footer, dismissible = true }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 shadow-xl backdrop:bg-brand-navy/50"
      // Esc: the parent decides, through `open`, rather than the browser closing it.
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      // Browsers close it themselves on a second Esc in a row: keep the parent in step, or
      // reopen it while it cannot be dismissed. (When `open` is false, the effect closed it.)
      onClose={() => {
        if (!open) return;
        if (dismissible) onClose();
        else ref.current?.showModal();
      }}
      // Clicks on the backdrop target the dialog itself, while the card's content fills the
      // rest. Both the press and the release must be on the backdrop, so selecting text and
      // letting go outside the card, or the other way round, does not close it.
      onMouseDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOnBackdrop.current && event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      {open && (
        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <h2 id={titleId} className="text-lg font-semibold text-brand-navy">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-brand-gray">
                {description}
              </p>
            )}
          </div>
          {children}
          <div className="flex flex-wrap justify-end gap-2">{footer}</div>
        </div>
      )}
    </dialog>
  );
}

/**
 * The action a dialog runs (deleting, saving…): whether it is running, and if it failed,
 * why. A failure keeps the dialog open with the reason, to try again or cancel. `close`
 * closes the dialog (through `onClose`), forgetting the failure.
 */
export function useDialogAction(onClose: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  /** Runs `action`, and closes the dialog once it has succeeded. */
  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run, close };
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while `onConfirm` runs, e.g. "Deleting…". */
  pendingLabel?: string;
  /** For actions that cannot be undone: a red button, and Cancel focused first. */
  destructive?: boolean;
  /** Does the action. If it fails, the dialog stays open and says why, to try again. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Asks the user to confirm an action, and closes once it is done. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { pending, error, run, close } = useDialogAction(onClose);

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      description={description}
      dismissible={!pending}
      footer={
        // The safe choice is focused first: Cancel when the action cannot be undone.
        <>
          <button type="button" onClick={close} disabled={pending} data-autofocus={destructive || undefined} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => run(onConfirm)}
            disabled={pending}
            data-autofocus={!destructive || undefined}
            className={destructive ? destructiveButton : primaryButton}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </>
      }
    >
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Modal>
  );
}
