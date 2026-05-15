"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { RecurringRule } from "@/lib/recurring";
import { fillPendingRecurringAction } from "@/app/(app)/recurring/actions";
import { EmojiOrIcon, JtIcon, iconNameToEmoji } from "@/components/icons";
import { formatDate } from "@/lib/utils";

/**
 * Variable-cost recurring rules waiting for the user to plug in an amount.
 * Lives at the top of /recurring so the user always sees the bills they
 * need to file as soon as they land on the page.
 */
export function PendingRecurringPanel({
  pending,
  homeCurrency,
  fmtLocale,
}: {
  pending: RecurringRule[];
  homeCurrency: string;
  fmtLocale: string;
}) {
  const t = useTranslations();

  return (
    <section className="rounded-2xl border border-(--accent)/40 bg-(--accent)/5 p-4 space-y-3">
      <header className="flex items-center gap-2">
        <JtIcon name="bell" size={20} />
        <h2 className="font-semibold">
          {t("recurring.pendingTitle", { count: pending.length })}
        </h2>
      </header>
      <p className="text-xs text-(--muted)">{t("recurring.pendingHint")}</p>
      <ul className="divide-y divide-(--border) rounded-xl border border-(--border) bg-(--card)">
        {pending.map((rule) => (
          <PendingRow
            key={rule.id}
            rule={rule}
            homeCurrency={homeCurrency}
            fmtLocale={fmtLocale}
          />
        ))}
      </ul>
    </section>
  );
}

function PendingRow({
  rule,
  homeCurrency,
  fmtLocale,
}: {
  rule: RecurringRule;
  homeCurrency: string;
  fmtLocale: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const currency = rule.fx_currency ?? homeCurrency;

  function submit() {
    if (!amount.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("amount", amount);
    startTransition(async () => {
      const result = await fillPendingRecurringAction(rule.id, fd);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setAmount("");
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="shrink-0">
        <EmojiOrIcon
          value={rule.category?.icon}
          fallback="sparkle"
          size={24}
        />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {rule.note || rule.category?.name || t("recurring.untitled")}
        </div>
        <div className="text-xs text-(--muted) truncate">
          {iconNameToEmoji(rule.category?.icon)} {rule.category?.name ?? "—"} ·{" "}
          {t("recurring.dueOn", {
            when: formatDate(rule.next_run_at, fmtLocale),
          })}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-1.5"
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("recurring.amountPlaceholder", { currency })}
          aria-label={t("recurring.amountLabel")}
          className="w-24 sm:w-28 px-2 py-1.5 rounded-lg border border-(--border) bg-(--background) text-sm tabular-nums text-right"
        />
        <button
          type="submit"
          disabled={pending || !amount.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) text-sm font-medium disabled:opacity-50"
        >
          <JtIcon name="check" size={16} />
          <span className="hidden sm:inline">{t("recurring.fillAndAdd")}</span>
        </button>
      </form>
      {error && (
        <span className="text-xs text-(--expense)">{error}</span>
      )}
    </li>
  );
}
