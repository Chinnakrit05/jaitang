"use server";

import { getLocale } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { runChat, type ChatMessage } from "@/lib/chat-ai";

export async function sendChatMessageAction(
  history: ChatMessage[]
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const { ledgerId, ledger } = await requireSession();
  const locale = await getLocale();

  // Defensive cap: don't let history blow up the prompt context.
  const trimmed = history.slice(-20);

  // Reject obviously malformed input so we don't waste an API call.
  if (
    trimmed.length === 0 ||
    !trimmed.every(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length < 4000
    )
  ) {
    return { ok: false, error: "Invalid message history" };
  }

  return runChat(trimmed, {
    ledgerId,
    homeCurrency: ledger.currency,
    locale,
  });
}
