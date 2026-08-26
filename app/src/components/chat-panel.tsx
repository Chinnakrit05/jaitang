"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

import { sendChatMessageAction } from "@/app/(app)/chat/actions";
import type { ChatMessage } from "@/lib/chat-ai";
import { EmptyIllustration } from "@/components/empty-illustration";

/**
 * Chat panel for /chat. Holds conversation in memory only — refresh
 * wipes history (server doesn't persist anything either). v1 trade-off:
 * skipped storage to keep schema lean. If users want it later, we add
 * a `chat_sessions` + `chat_messages` table.
 *
 * Loading state: while the action runs (which may include several
 * tool-use round-trips), we show a typing indicator. The animation
 * is plain CSS dots so we don't pull in a spinner library.
 */
export function ChatPanel({
  suggestedPrompts,
}: {
  suggestedPrompts: string[];
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history.length, pending]);

  function send(text: string) {
    if (!text.trim() || pending) return;
    setError(null);
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const next = [...history, userMsg];
    setHistory(next);
    setInput("");
    startTransition(async () => {
      const result = await sendChatMessageAction(next);
      if (result.ok === false) {
        setError(result.error);
        // Roll back the optimistic user msg so retry doesn't double-send.
        setHistory(history);
        return;
      }
      setHistory((prev) => [
        ...prev,
        { role: "assistant", content: result.reply },
      ]);
    });
  }

  const empty = history.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] sm:h-[calc(100vh-7rem)] max-h-[700px]">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-[22px] soft-raised p-4 space-y-3"
      >
        {empty ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <EmptyIllustration kind="chat" className="mb-3" />
            <h2 className="font-semibold mb-1">{t("chat.emptyTitle")}</h2>
            <p className="text-sm text-(--muted) mb-4">
              {t("chat.emptyHint")}
            </p>
            <div className="grid grid-cols-1 gap-2 w-full">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  disabled={pending}
                  className="text-left text-sm px-3 py-2 rounded-xl border border-(--border) bg-(--background) hover:bg-(--card) transition disabled:opacity-50"
                >
                  &ldquo;{p}&rdquo;
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))
        )}
        {pending && (
          <div className="flex gap-2 items-end">
            <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-(--accent)/10 text-(--accent)">
              <JtIcon name="bot" size={18} />
            </span>
            <div className="rounded-2xl rounded-tl-sm bg-(--background) border border-(--border) px-3 py-2.5 text-sm">
              <span className="inline-flex gap-1 items-center text-(--muted)">
                <span className="dot" />
                <span className="dot" style={{ animationDelay: "150ms" }} />
                <span className="dot" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="ml-2 text-xs text-(--muted)">
                {t("chat.thinking")}
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          disabled={pending}
          maxLength={3000}
          className="flex-1 px-4 py-3 rounded-[22px] soft-raised focus:outline-none focus:ring-2 focus:ring-(--accent) text-sm"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="px-4 py-3 rounded-2xl bg-(--accent) text-(--accent-foreground) font-semibold text-sm disabled:opacity-50 cta-primary inline-flex items-center gap-1.5"
          aria-label={t("chat.sendAria")}
        >
          <JtIcon name="send" size={18} />
          <span className="hidden sm:inline">{t("chat.send")}</span>
        </button>
      </form>

      {/* Local CSS for the typing dots — small enough to keep inline. */}
      <style jsx>{`
        .dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          background: currentColor;
          border-radius: 50%;
          opacity: 0.5;
          animation: chatDot 1s infinite ease-in-out;
        }
        @keyframes chatDot {
          0%,
          80%,
          100% {
            transform: scale(0.7);
            opacity: 0.4;
          }
          40% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function Bubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-(--accent)/10 text-(--accent)">
          <JtIcon name="bot" size={18} />
        </span>
      )}
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed max-w-[85%] ${
          isUser
            ? "rounded-tr-sm bg-(--accent) text-(--accent-foreground)"
            : "rounded-tl-sm bg-(--background) border border-(--border)"
        }`}
      >
        {content}
      </div>
      {isUser && (
        <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-(--background) border border-(--border) text-(--muted)">
          <JtIcon name="user" size={18} />
        </span>
      )}
    </div>
  );
}
