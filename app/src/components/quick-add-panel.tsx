"use client";

import { useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { quickAddAction, type QuickAddResponse } from "@/app/(app)/quick/actions";
import { formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

const EXAMPLES = [
  "30 bts",
  "ค่ากาแฟ 65",
  "salary 30000",
  "+500 freelance",
  "ข้าว 120 เมื่อวาน",
];

export function QuickAddPanel() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [last, setLast] = useState<Extract<QuickAddResponse, { ok: true }> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!text.trim() || pending) return;
    setError(null);
    const fd = new FormData();
    fd.set("text", text);
    startTransition(async () => {
      const result = await quickAddAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLast(result);
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-3">
        <div className="flex items-start gap-2">
          <JtIcon name="sparkles" size={22} className="text-(--accent) shrink-0 mt-1" />
          <p className="text-sm text-(--muted)">{t("quick.hint")}</p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("quick.placeholder")}
          rows={2}
          className="w-full px-3 py-3 rounded-xl border border-(--border) bg-(--background) text-base focus:outline-none focus:ring-2 focus:ring-(--accent) resize-none"
          autoFocus
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-(--muted)">{t("quick.enterHint")}</span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !text.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? (
              <>
                <JtIcon name="loader-2" size={20} className="animate-spin" />
                {t("quick.thinking")}
              </>
            ) : (
              <>
                <JtIcon name="send" size={20} />
                {t("quick.submit")}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Examples */}
      <div className="flex flex-wrap gap-2 px-1">
        <span className="text-xs text-(--muted) py-1.5">{t("quick.examples")}:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            disabled={pending}
            className="text-xs px-2.5 py-1 rounded-full border border-(--border) bg-(--card) text-(--muted) hover:text-(--foreground) hover:bg-(--background) transition disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Last saved */}
      {last && (
        <div className="rounded-2xl border border-(--income)/40 bg-(--income)/5 p-4 flex items-start gap-3">
          <JtIcon name="check-circle-2" size={24} className="text-(--income) shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2 flex-wrap">
              <span>{t("quick.savedTitle")}</span>
              <span
                className={`tabular-nums font-semibold ${
                  last.kind === "income" ? "text-(--income)" : "text-(--expense)"
                }`}
              >
                {last.kind === "income" ? "+" : "−"}
                {formatCurrency(last.amount, "THB", fmtLocale)}
              </span>
              {last.categoryIcon && (
                <span className="text-sm">
                  {last.categoryIcon} {last.categoryName ?? ""}
                </span>
              )}
            </div>
            {last.note && (
              <div className="text-sm text-(--muted) mt-0.5 truncate">{last.note}</div>
            )}
            {last.confidence !== "high" && (
              <div className="text-xs text-amber-500 mt-1">
                {last.confidence === "medium"
                  ? t("quick.confidenceMedium")
                  : t("quick.confidenceLow")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-(--expense)/40 bg-(--expense)/5 p-4 flex items-start gap-3">
          <JtIcon name="alert-circle" size={24} className="text-(--expense) shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-(--expense)">{error}</div>
        </div>
      )}
    </div>
  );
}
