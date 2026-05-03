import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { ChatPanel } from "@/components/chat-panel";

export default async function ChatPage() {
  const t = await getTranslations();
  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;

  // Require auth so unauthenticated visitors don't see the page even
  // empty.
  await requireSession();

  if (!aiEnabled) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles size={20} className="text-(--accent)" />
          {t("chat.title")}
        </h1>
        <p className="text-sm text-(--muted)">{t("chat.disabled")}</p>
      </div>
    );
  }

  // Suggested prompts shown in the empty state. Localized — lets us
  // demonstrate the assistant's range without overwhelming new users.
  const suggested = [
    t("chat.suggest1"),
    t("chat.suggest2"),
    t("chat.suggest3"),
    t("chat.suggest4"),
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles size={20} className="text-(--accent)" />
          {t("chat.title")}
        </h1>
        <p className="text-sm text-(--muted) mt-1">{t("chat.subtitle")}</p>
      </div>
      <ChatPanel suggestedPrompts={suggested} />
    </div>
  );
}
