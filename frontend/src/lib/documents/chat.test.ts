import { describe, expect, it, vi } from "vitest";
import { ApiError, GENERIC_ERROR } from "../api";
import { jsonResponse } from "../testing";
import { GREETING, MAX_HISTORY, sendChatMessage, type ChatMessage, type Draft } from "./chat";

const messages: ChatMessage[] = [GREETING, { role: "user", content: "An NDA with Globex LLC" }];
const noDraft: Draft = { documentId: null, values: {} };

describe("sendChatMessage", () => {
  it("posts the conversation, draft and date, and returns the reply and new draft", async () => {
    const reply = { reply: "Who signs?", documentId: "mutual-nda", values: { "party2.company": "Globex LLC" } };
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, reply));

    expect(await sendChatMessage(messages, noDraft, "2026-10-28", fetchImpl)).toEqual(reply);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      messages,
      documentId: null,
      values: {},
      today: "2026-10-28",
    });
  });

  it("sends only the latest messages of a long conversation", async () => {
    const long: ChatMessage[] = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { reply: "Ok", ...noDraft }));

    await sendChatMessage(long, noDraft, "2026-10-28", fetchImpl);

    const sent = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(sent.messages).toEqual(long.slice(-MAX_HISTORY));
  });

  it("shows the backend's error message", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(502, { detail: "The AI assistant could not answer. Please try again." }),
    );
    await expect(sendChatMessage(messages, noDraft, "2026-10-28", fetchImpl)).rejects.toEqual(
      new ApiError(502, "The AI assistant could not answer. Please try again."),
    );
  });

  it("falls back to a generic message for validation errors and non-JSON answers", async () => {
    for (const response of [
      jsonResponse(422, { detail: [{ msg: "Field required" }] }),
      new Response("Bad Gateway", { status: 502 }),
      new Response("<html>Proxy page</html>", { status: 200 }),
    ]) {
      await expect(sendChatMessage(messages, noDraft, "2026-10-28", async () => response)).rejects.toThrow(
        GENERIC_ERROR,
      );
    }
  });

  it("reports a network failure", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(sendChatMessage(messages, noDraft, "2026-10-28", fetchImpl)).rejects.toThrow(
      "Could not reach Prelegal",
    );
  });
});
