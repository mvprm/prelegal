import type { NdaFields } from "./fields";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** The assistant's opening message. Written here rather than generated, so it shows instantly. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you put together a Mutual Non-Disclosure Agreement. To start, which two " +
    "companies are entering into it, and which one is yours?",
};

/** The longest message the backend accepts (`MAX_MESSAGE_LENGTH` in backend/app/nda.py). */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * How many of the latest messages are sent with each request. Older ones are left out to
 * keep requests small; the fields already hold what they settled.
 */
export const MAX_HISTORY = 40;

export interface ChatReply {
  reply: string;
  fields: NdaFields;
}

/** A failed chat request, with a message that can be shown to the user. */
export class ChatError extends Error {}

export const GENERIC_ERROR = "Sorry, something went wrong. Please try again.";

/**
 * Sends the conversation, ending with the user's new message, to the AI assistant. Returns
 * its reply and the fields with the user's answers filled in.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  fields: NdaFields,
  today: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatReply> {
  let response: Response;
  try {
    response = await fetchImpl("/api/nda/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Invalid years (NaN) are sent as null, which JSON.stringify does by itself.
      body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), fields, today }),
    });
  } catch {
    throw new ChatError("Could not reach Prelegal. Check your connection and try again.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // The backend's own errors carry a readable message; validation errors carry a list.
    throw new ChatError(typeof body?.detail === "string" ? body.detail : GENERIC_ERROR);
  }

  const reply: ChatReply = await response.json().catch(() => {
    throw new ChatError(GENERIC_ERROR);
  });
  return { reply: reply.reply, fields: withYearsAsNumbers(reply.fields) };
}

/** Turns the null years that NaN was sent as back into NaN, as the form holds them. */
function withYearsAsNumbers(fields: NdaFields): NdaFields {
  return {
    ...fields,
    mndaTermYears: fields.mndaTermYears ?? Number.NaN,
    confidentialityYears: fields.confidentialityYears ?? Number.NaN,
  };
}
