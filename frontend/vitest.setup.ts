/**
 * Runs before every test file. Tests run in Node; component tests ask for a browser-like
 * DOM with a `// @vitest-environment jsdom` comment, and get the extras below.
 */
import { afterEach } from "vitest";

if (typeof window !== "undefined") {
  // Without Vitest's globals, Testing Library cannot unmount what a test rendered by itself.
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);

  // jsdom has <dialog> but not showModal() or close(): open and close it as browsers do,
  // apart from what jsdom cannot do (the top layer, the inert page, Esc).
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
