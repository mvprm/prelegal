import type { Values } from "./catalog";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** The assistant's opening message. Written here rather than generated, so it shows instantly. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm here to help you draft a legal agreement, such as an NDA, a cloud service " +
    "agreement or a data processing agreement. What would you like to put in place, and " +
    "with whom?",
};

/** The longest message the backend accepts (`MAX_MESSAGE_LENGTH` in backend/app/chat.py). */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * The longest field value the backend accepts (`MAX_VALUE_LENGTH` in backend/app/documents.py).
 * Longer values would make every chat request fail, so the form does not allow them.
 */
export const MAX_VALUE_LENGTH = 5000;

/**
 * How many of the latest messages are sent with each request. Older ones are left out to
 * keep requests small; the values already hold what they settled.
 */
export const MAX_HISTORY = 40;

/** The document being drafted, if one has been chosen, and its values. */
export interface Draft {
  documentId: string | null;
  values: Values;
}

export interface ChatReply extends Draft {
  reply: string;
}

/** A failed chat request, with a message that can be shown to the user. */
export class ChatError extends Error {}

export const GENERIC_ERROR = "Sorry, something went wrong. Please try again.";

/**
 * Sends the conversation, ending with the user's new message, to the AI assistant. Returns
 * its reply and the draft as it now stands: the document may have been chosen or changed,
 * and the values have the user's answers filled in.
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  draft: Draft,
  today: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatReply> {
  let response: Response;
  try {
    response = await fetchImpl("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), ...draft, today }),
    });
  } catch {
    throw new ChatError("Could not reach Prelegal. Check your connection and try again.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    // The backend's own errors carry a readable message; validation errors carry a list.
    throw new ChatError(typeof body?.detail === "string" ? body.detail : GENERIC_ERROR);
  }

  return response.json().catch(() => {
    throw new ChatError(GENERIC_ERROR);
  });
}
