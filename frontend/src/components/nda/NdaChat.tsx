import { useEffect, useId, useRef, useState } from "react";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/nda/chat";
import type { NdaChatState } from "./useNdaChat";

interface NdaChatProps {
  chat: NdaChatState;
  /** False until the page has hydrated and knows today's date. */
  ready: boolean;
}

/** The conversation with the AI assistant, and a box to write the next message. */
export function NdaChat({ chat, ready }: NdaChatProps) {
  const { messages, pending, error, send, retry } = chat;
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const logRef = useRef<HTMLDivElement>(null);

  const canSend = ready && !pending && draft.trim() !== "";

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending, error]);

  function submit() {
    if (!canSend) return;
    send(draft.trim());
    setDraft("");
  }

  return (
    <div className="flex h-[32rem] flex-col rounded-lg border border-neutral-200 bg-white shadow-sm lg:h-[40rem]">
      <div ref={logRef} role="log" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, i) => (
          <Bubble key={i} role={message.role}>
            {message.content}
          </Bubble>
        ))}
        {pending && (
          <Bubble role="assistant">
            <span className="animate-pulse text-brand-gray">Thinking…</span>
          </Bubble>
        )}
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            <span>{error}</span>
            <button
              type="button"
              onClick={retry}
              className="font-semibold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-neutral-200 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Your message
        </label>
        <textarea
          id={inputId}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Type your answer…"
          className="flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends and Shift+Enter starts a new line, unless an IME is composing text.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-md bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: ChatMessage["role"]; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser ? "bg-brand-blue text-white" : "bg-neutral-100 text-neutral-900"
        }`}
      >
        <span className="sr-only">{isUser ? "You: " : "Assistant: "}</span>
        {children}
      </p>
    </div>
  );
}
