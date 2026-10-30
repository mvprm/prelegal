"use client";

import { useId, useState } from "react";
import { MAX_TITLE_LENGTH } from "@/lib/documents/saved";
import { Modal, useDialogAction } from "../Modal";
import { ErrorMessage, inputClass, primaryButton, secondaryButton } from "../ui";

interface RenameDialogProps {
  open: boolean;
  /** The name the user gave the document, or null while it has its default name. */
  title: string | null;
  /** The name of its kind of document, which it goes back to when the box is cleared. */
  defaultName: string;
  /** Saves the name as typed (empty for the default). If it fails, the dialog says why. */
  onRename: (title: string) => Promise<void>;
  onClose: () => void;
}

/** Asks for a new name for a document. */
export function RenameDialog({ open, title, defaultName, onRename, onClose }: RenameDialogProps) {
  const { pending, error, run, close } = useDialogAction(onClose);
  const formId = useId();

  function save(text: string) {
    // Saving the same name again would change nothing, so the dialog just closes.
    if (text.trim() === (title ?? "")) close();
    else run(() => onRename(text));
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Rename document"
      description={`Leave it empty to call it “${defaultName}”.`}
      dismissible={!pending}
      footer={
        <>
          <button type="button" onClick={close} disabled={pending} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <NameForm id={formId} initial={title ?? ""} placeholder={defaultName} disabled={pending} onSubmit={save} />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </Modal>
  );
}

/** The name box, mounted each time the dialog opens, so it starts from the current name. */
function NameForm({
  id,
  initial,
  placeholder,
  disabled,
  onSubmit,
}: {
  id: string;
  initial: string;
  placeholder: string;
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const inputId = useId();

  return (
    <form
      id={id}
      className="space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(text);
      }}
    >
      <label htmlFor={inputId} className="block text-sm font-medium text-brand-navy">
        Name
      </label>
      <input
        id={inputId}
        data-autofocus
        maxLength={MAX_TITLE_LENGTH}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        // Read-only rather than disabled while saving, so it keeps the focus.
        readOnly={disabled}
        className={inputClass}
      />
    </form>
  );
}
