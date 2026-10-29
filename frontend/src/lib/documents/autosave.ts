/**
 * Saving a draft automatically as it changes, without React, so the timing rules can be
 * tested on their own (`useAutosave` connects it to the page):
 *
 * - Changes are saved once they pause for `delayMs`, so typing in the form makes one
 *   request rather than one per key.
 * - Only one save runs at a time, and only the latest change is sent next, so saves reach
 *   the server in order and an older one can never overwrite a newer one.
 * - A failed save keeps the change, which is sent again with the next change or `flush()`.
 */

export type SaveStatus = "saved" | "saving" | "error";

export interface Autosaver<T> {
  /** Saves `draft` once changes pause, replacing any change not sent yet. */
  schedule: (draft: T) => void;
  /**
   * Saves the latest change now, e.g. to retry after an error. With `keepalive` (as the page
   * is closed) it is sent even while another save runs, since there will be no later chance.
   */
  flush: (options?: { keepalive?: boolean }) => void;
}

export function createAutosaver<T>(
  save: (draft: T, options: { keepalive?: boolean }) => Promise<unknown>,
  onStatus: (status: SaveStatus) => void,
  delayMs = 800,
): Autosaver<T> {
  let unsent: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving = 0;

  function run(options: { keepalive?: boolean } = {}) {
    clearTimeout(timer);
    timer = undefined;
    if (unsent === undefined || (saving > 0 && !options.keepalive)) return;
    const draft = unsent;
    unsent = undefined;
    saving += 1;
    onStatus("saving");
    save(draft, options).then(
      () => {
        saving -= 1;
        if (saving > 0) return;
        // Changes made while this one was saving go straight out.
        if (unsent !== undefined) run();
        else onStatus("saved");
      },
      () => {
        saving -= 1;
        unsent ??= draft;
        onStatus("error");
      },
    );
  }

  return {
    schedule(draft) {
      unsent = draft;
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    flush: run,
  };
}
