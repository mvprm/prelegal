import { describe, expect, it, vi } from "vitest";
import { ChatError, GREETING, MAX_HISTORY, sendChatMessage, type ChatMessage } from "./chat";
import { defaultFields } from "./fields";

const messages: ChatMessage[] = [GREETING, { role: "user", content: "Acme Inc. and Globex LLC" }];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("sendChatMessage", () => {
  it("posts the conversation, fields and date, and returns the reply", async () => {
    const filled = { ...defaultFields, party1: { ...defaultFields.party1, company: "Acme Inc." } };
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { reply: "Thanks!", fields: filled }));

    const turn = await sendChatMessage(messages, defaultFields, "2026-10-28", fetchImpl);

    expect(turn).toEqual({ reply: "Thanks!", fields: filled });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/nda/chat");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ messages, fields: defaultFields, today: "2026-10-28" });
  });

  it("sends only the latest messages of a long conversation", async () => {
    const long: ChatMessage[] = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
    }));
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { reply: "Ok", fields: defaultFields }));

    await sendChatMessage(long, defaultFields, "2026-10-28", fetchImpl);

    const sent = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(sent.messages).toEqual(long.slice(-MAX_HISTORY));
    expect(sent.messages.at(-1)).toEqual(long.at(-1));
  });

  it("round-trips invalid years from the form as NaN", async () => {
    const fields = { ...defaultFields, mndaTermYears: Number.NaN };
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const sent = JSON.parse(init?.body as string);
      expect(sent.fields.mndaTermYears).toBeNull();
      return jsonResponse(200, { reply: "Ok", fields: sent.fields });
    });

    const turn = await sendChatMessage(messages, fields, "2026-10-28", fetchImpl);

    expect(turn.fields.mndaTermYears).toBeNaN();
    expect(turn.fields.confidentialityYears).toBe(1);
  });

  it("shows the backend's error message", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      jsonResponse(502, { detail: "The AI assistant could not answer. Please try again." }),
    );
    await expect(sendChatMessage(messages, defaultFields, "2026-10-28", fetchImpl)).rejects.toEqual(
      new ChatError("The AI assistant could not answer. Please try again."),
    );
  });

  it("falls back to a generic message for validation errors and non-JSON answers", async () => {
    for (const response of [
      jsonResponse(422, { detail: [{ msg: "Field required" }] }),
      new Response("Bad Gateway", { status: 502 }),
      new Response("<html>Proxy page</html>", { status: 200 }),
    ]) {
      await expect(
        sendChatMessage(messages, defaultFields, "2026-10-28", async () => response),
      ).rejects.toEqual(new ChatError("Sorry, something went wrong. Please try again."));
    }
  });

  it("reports a network failure", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(sendChatMessage(messages, defaultFields, "2026-10-28", fetchImpl)).rejects.toThrow(
      "Could not reach Prelegal",
    );
  });
});
