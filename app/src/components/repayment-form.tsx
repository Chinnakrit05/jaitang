"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toLocalDateTimeInput } from "@/lib/utils";
import { addRepaymentAction } from "@/app/(app)/loans/actions";

/**
 * Inline form on the loan detail page. Logs a partial repayment;
 * server flips the loan to settled when total repayments meet/exceed
 * principal.
 */
export function RepaymentForm({
  loanId,
  currency,
  remaining,
}: {
  loanId: string;
  currency: string;
  remaining: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = dateRef.current;
    if (!el) return;
    el.value = toLocalDateTimeInput(new Date());
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const occRaw = fd.get("occurredAt");
        if (typeof occRaw === "string" && occRaw.length > 0) {
          const inst = new Date(occRaw);
          if (!Number.isNaN(inst.getTime())) {
            fd.set("occurredAt", inst.toISOString());
          }
        }
        setError(null);
        startTransition(async () => {
          const result = await addRepaymentAction(loanId, fd);
          if (result && "ok" in result && result.ok === false) {
            setError(result.error);
            return;
          }
          setAmount("");
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max={remaining > 0 ? remaining : undefined}
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("loans.repaymentAmountPlaceholder", { currency })}
          className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm tabular-nums"
        />
        <input
          ref={dateRef}
          name="occurredAt"
          type="datetime-local"
          required
          suppressHydrationWarning
          className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
        />
        <button
          type="submit"
          disabled={pending || !amount}
          className="w-full px-4 py-2 rounded-xl bg-(--accent) text-(--accent-foreground) font-semibold text-sm disabled:opacity-50"
        >
          {pending ? t("common.saving") : t("loans.repaymentButton")}
        </button>
      </div>
      <input
        name="note"
        type="text"
        maxLength={500}
        placeholder={t("loans.repaymentNotePlaceholder")}
        className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
      />
      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </form>
  );
}
