import { useState } from "react";
import { ChatError, GENERIC_ERROR, GREETING, sendChatMessage, type ChatMessage } from "@/lib/nda/chat";
import type { NdaFields } from "@/lib/nda/fields";

export interface NdaChatState {
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
 * The conversation with the AI assistant. Each reply comes with the fields filled in from
 * the user's answers, which are passed to `onFieldsChange`.
 */
export function useNdaChat(
  fields: NdaFields,
  today: string,
  onFieldsChange: (fields: NdaFields) => void,
): NdaChatState {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestReply(history: ChatMessage[]) {
    setPending(true);
    setError(null);
    try {
      const { reply, fields: filled } = await sendChatMessage(history, fields, today);
      setMessages([...history, { role: "assistant", content: reply }]);
      onFieldsChange(filled);
    } catch (e) {
      if (!(e instanceof ChatError)) console.error(e);
      setError(e instanceof ChatError ? e.message : GENERIC_ERROR);
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
