"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { fillPendingRecurringAmountAction } from "@/app/(app)/recurring/actions";
import type { ScanRecurringMatch } from "@/app/(app)/transactions/receipt-items-action";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";

/**
 * Offer to file a scan against the bill it looks like paying.
 *
 * A recurring rule with no amount sits waiting until the bill arrives.
 * Scanning that bill and saving it as a fresh transaction leaves the rule
 * still waiting — so the month ends up with the payment twice, once typed
 * and once filled, or with the rule never closed at all.
 *
 * It is an offer, not a redirect: the form underneath stays filled in, so
 * dismissing this and saving normally does exactly what it did before.
 * Taking the offer writes through the rule and leaves for the list, the
 * same place saving the form goes, because the transaction now exists and
 * submitting the form as well is the mistake this is here to avoid.
 */
export function RecurringScanBanner({
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

  function fill() {
    setError(null);
    startSaving(async () => {
      const result = await fillPendingRecurringAmountAction(
        match.ruleId,
        match.amount
      );
      if (result?.ok === false) {
        setError(result.error);
        return;
      }
      router.push("/transactions");
    });
  }

  return (
    <div className="rounded-[22px] soft-raised p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5">
          <JtIcon name="recurring" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">
              {t("recurring.scanMatch.title")}
            </p>
            {match.confidence === "medium" && (
              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full soft-well-sm">
                {t("recurring.scanMatch.maybe")}
              </span>
            )}
          </div>
          <p className="text-sm text-(--muted) mt-1 flex items-center gap-1.5 flex-wrap">
            {match.categoryIcon && (
              <EmojiOrIcon value={match.categoryIcon} size={16} />
            )}
            <span className="font-medium text-(--foreground)">
              {match.note || match.categoryName}
            </span>
            <span>·</span>
            <span className="tabular-nums">
              {formatCurrency(match.amount, currency, fmtLocale)}
            </span>
          </p>
          {match.lastFillAmount !== null && (
            <p className="text-[11px] text-(--muted) mt-0.5 tabular-nums">
              {t("recurring.scanMatch.lastCycle", {
                amount: formatCurrency(
                  match.lastFillAmount,
                  currency,
                  fmtLocale
                ),
              })}
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-(--expense)">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          disabled={saving}
          className="flex-1 min-w-0 h-10 px-3 rounded-[14px] soft-raised-sm soft-pressable text-sm font-medium leading-tight disabled:opacity-50"
        >
          {t("recurring.scanMatch.dismiss")}
        </button>
        <button
          type="button"
          onClick={fill}
          disabled={saving}
          className="flex-[2] min-w-0 h-10 px-3 rounded-[14px] bg-(--accent) text-(--accent-foreground) text-sm font-semibold leading-tight disabled:opacity-50"
        >
          {saving
            ? t("common.saving")
            : t("recurring.scanMatch.fill")}
        </button>
      </div>
    </div>
  );
}
