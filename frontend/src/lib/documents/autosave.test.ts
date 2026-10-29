import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaver, type SaveStatus } from "./autosave";

/** A save that stays in flight until the test settles it. */
function controlledSave() {
  const calls: { draft: string; keepalive?: boolean; resolve: () => void; reject: () => void }[] = [];
  const save = vi.fn(
    (draft: string, options: { keepalive?: boolean }) =>
      new Promise<void>((resolve, reject) => calls.push({ draft, keepalive: options.keepalive, resolve, reject })),
  );
  return { save, calls };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createAutosaver", () => {
  it("saves once changes pause, sending only the latest", async () => {
    const { save, calls } = controlledSave();
    const statuses: SaveStatus[] = [];
    const saver = createAutosaver(save, (status) => statuses.push(status), 800);

    saver.schedule("a");
    vi.advanceTimersByTime(500);
    saver.schedule("ab");
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(calls.map((call) => call.draft)).toEqual(["ab"]);
    expect(statuses).toEqual(["saving"]);

    calls[0].resolve();
    await vi.runAllTimersAsync();
    expect(statuses).toEqual(["saving", "saved"]);
  });

  it("runs one save at a time, then sends the latest change made meanwhile", async () => {
    const { save, calls } = controlledSave();
    const saver = createAutosaver(save, () => {}, 800);

    saver.schedule("first");
    vi.advanceTimersByTime(800);
    saver.schedule("second");
    saver.schedule("third");
    vi.advanceTimersByTime(800);
    expect(calls).toHaveLength(1);

    calls[0].resolve();
    await vi.runAllTimersAsync();
    expect(calls.map((call) => call.draft)).toEqual(["first", "third"]);
  });

  it("keeps a change whose save failed, and sends it on flush", async () => {
    const { save, calls } = controlledSave();
    const statuses: SaveStatus[] = [];
    const saver = createAutosaver(save, (status) => statuses.push(status), 800);

    saver.schedule("draft");
    vi.advanceTimersByTime(800);
    calls[0].reject();
    await vi.runAllTimersAsync();
    expect(statuses).toEqual(["saving", "error"]);

    saver.flush();
    expect(calls.map((call) => call.draft)).toEqual(["draft", "draft"]);
    calls[1].resolve();
    await vi.runAllTimersAsync();
    expect(statuses).toEqual(["saving", "error", "saving", "saved"]);
  });

  it("sends a newer change rather than the failed one", async () => {
    const { save, calls } = controlledSave();
    const saver = createAutosaver(save, () => {}, 800);

    saver.schedule("old");
    vi.advanceTimersByTime(800);
    saver.schedule("new");
    calls[0].reject();
    await vi.runAllTimersAsync();

    expect(calls.map((call) => call.draft)).toEqual(["old", "new"]);
  });

  it("flushes straight away, passing keepalive on", () => {
    const { save, calls } = controlledSave();
    const saver = createAutosaver(save, () => {}, 800);

    saver.schedule("draft");
    saver.flush({ keepalive: true });

    expect(calls).toMatchObject([{ draft: "draft", keepalive: true }]);
    vi.advanceTimersByTime(800);
    expect(calls).toHaveLength(1);
  });

  it("sends the last change as the page closes, even while another save runs", () => {
    const { save, calls } = controlledSave();
    const saver = createAutosaver(save, () => {}, 800);

    saver.schedule("first");
    saver.flush();
    saver.schedule("second");
    saver.flush();
    expect(calls).toHaveLength(1);

    saver.flush({ keepalive: true });
    expect(calls).toMatchObject([{ draft: "first" }, { draft: "second", keepalive: true }]);
  });

  it("does nothing on flush when everything is saved", () => {
    const { save } = controlledSave();
    createAutosaver(save, () => {}).flush();
    expect(save).not.toHaveBeenCalled();
  });
});
