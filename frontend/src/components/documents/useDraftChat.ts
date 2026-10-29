import { useState } from "react";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import { sendChatMessage, type ChatMessage, type Draft } from "@/lib/documents/chat";

export interface DraftChatState {
  messages: ChatMessage[];
  /** True while waiting for the assistant's reply. */
  pending: boolean;
  /** Why the last message got no reply, if it failed. */
  error: string | null;
  send: (text: string) => void;
  /** Asks again for a reply to the last message, after an error. */
  retry: () => void;
}

/**
 * The conversation with the AI assistant, opening with `greeting`. Each reply comes with
 * the draft as it now stands (the chosen document and its values), which is passed to
 * `onDraftChange`.
 */
export function useDraftChat(
  draft: Draft,
  today: string,
  onDraftChange: (draft: Draft) => void,
  greeting: ChatMessage,
): DraftChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestReply(history: ChatMessage[]) {
    setPending(true);
    setError(null);
    try {
      const { reply, documentId, values } = await sendChatMessage(history, draft, today);
      setMessages([...history, { role: "assistant", content: reply }]);
      onDraftChange({ documentId, values });
    } catch (e) {
      if (!(e instanceof ApiError)) console.error(e);
      setError(e instanceof ApiError ? e.message : GENERIC_ERROR);
    } finally {
      setPending(false);
    }
  }

  function send(text: string) {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    void requestReply(history);
  }

  return { messages, pending, error, send, retry: () => void requestReply(messages) };
}
