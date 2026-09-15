"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { addScanToRecurringAction } from "@/app/(app)/recurring/actions";
import type { ScanRecurringMatch } from "@/app/(app)/transactions/receipt-items-action";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";

/**
 * Asked the moment a scan comes back looking like one of the ledger's
 * recurring rules: "put all of this into แมว?"
 *
 * A question, not a banner, because the two answers write different
 * things and the form underneath is already filled in with the second
 * one. A banner could be scrolled past and the form saved as a fresh
 * transaction on top of the rule — the double count this is here to
 * stop. So nothing else on the screen can be pressed until it's
 * answered.
 *
 * "Yes" adds the receipt to the month's total (1,805 + 640 = 2,445)
 * and leaves for the transaction list, where saving the form would have
 * gone. "No" closes this and leaves the form exactly as the scan filled
 * it.
 */
export function RecurringScanPrompt({
  match,
  currency,
  onDismiss,
}: {
  match: ScanRecurringMatch;
  currency: string;
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const fmtLocale = intlLocale(useLocale());
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const name = match.note || match.categoryName || "";
  const money = (n: number) => formatCurrency(n, currency, fmtLocale);
  const after = Math.round(((match.monthAmount ?? 0) + match.amount) * 100) / 100;
  const monthLabel = new Date(Date.UTC(match.year, match.month - 1, 1))
    .toLocaleDateString(fmtLocale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  function accept() {
    setError(null);
    startSaving(async () => {
      const result = await addScanToRecurringAction(match.ruleId, {
        year: match.year,
        month: match.month,
        amount: match.amount,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      router.push("/transactions");
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-scan-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-[rgba(24,20,16,0.45)] backdrop-blur-[2.5px]"
    >
      <div className="w-full max-w-[340px] rounded-[24px] soft-raised p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 h-10 w-10 rounded-full soft-well-sm flex items-center justify-center">
            {match.categoryIcon ? (
              <EmojiOrIcon value={match.categoryIcon} size={22} />
            ) : (
              <JtIcon name="recurring" size={20} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="recurring-scan-title"
              className="font-semibold text-[15px] leading-snug"
            >
              {t("recurring.scanMatch.title", { name })}
            </h2>
            <p className="mt-0.5 text-xs text-(--muted) flex items-center gap-1.5 flex-wrap">
              <span>{monthLabel}</span>
              {match.confidence === "medium" && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full soft-well-sm">
                  {t("recurring.scanMatch.maybe")}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* The sum, spelt out: what is there, what this adds, what it
            becomes. Without the first line "add to แมว" reads as
            "replace แมว". */}
        <dl className="rounded-[16px] soft-well-sm px-4 py-3 space-y-1.5 text-sm tabular-nums">
          {match.monthAmount !== null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-(--muted)">{t("recurring.scanMatch.before")}</dt>
              <dd className="m-0">{money(match.monthAmount)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-(--muted)">{t("recurring.scanMatch.adding")}</dt>
            <dd className="m-0">+ {money(match.amount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-(--border)">
            <dt className="font-medium">{t("recurring.scanMatch.after")}</dt>
            <dd className="m-0 font-semibold text-base">{money(after)}</dd>
          </div>
        </dl>

        {error && <p className="text-sm text-(--expense)">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="flex-1 min-w-0 h-11 px-3 rounded-[14px] soft-raised-sm soft-pressable text-sm font-medium disabled:opacity-50"
          >
            <span className="block truncate">{t("recurring.scanMatch.dismiss")}</span>
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={saving}
            autoFocus
            className="flex-1 min-w-0 h-11 px-3 rounded-[14px] bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50"
          >
            {/* truncate, because the label carries the rule's name and
                a rule can be called "คอนเทคเลนส์รายเดือน". */}
            <span className="block truncate">
              {saving
                ? t("common.saving")
                : t("recurring.scanMatch.fill", { name })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
