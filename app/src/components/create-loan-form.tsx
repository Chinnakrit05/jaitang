"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

import { cn, toLocalDateTimeInput } from "@/lib/utils";
import { CurrencyPicker } from "@/components/currency-picker";
import { createLoanAction } from "@/app/(app)/loans/actions";
import type { LoanKind } from "@/lib/types";

export function CreateLoanForm({ ledgerCurrency }: { ledgerCurrency: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<LoanKind>("lent");
  const [currency, setCurrency] = useState(ledgerCurrency);

  const startedRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = startedRef.current;
    if (!el) return;
    el.value = toLocalDateTimeInput(new Date());
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("kind", kind);
        fd.set("currency", currency);
        // Convert TZ-naive datetime-local to UTC ISO.
        const startedRaw = fd.get("startedAt");
        if (typeof startedRaw === "string" && startedRaw.length > 0) {
          const inst = new Date(startedRaw);
          if (!Number.isNaN(inst.getTime())) {
            fd.set("startedAt", inst.toISOString());
          }
        }
        // dueDate is a date input — convert YYYY-MM-DD to ISO at end-of-day
        // so "due 2026-06-30" means due by the end of that day.
        const dueRaw = fd.get("dueDate");
        if (typeof dueRaw === "string" && dueRaw.length > 0) {
          // Append T23:59:00 in browser TZ then convert to UTC
          const inst = new Date(`${dueRaw}T23:59:00`);
          if (!Number.isNaN(inst.getTime())) {
            fd.set("dueDate", inst.toISOString());
          }
        } else {
          fd.delete("dueDate");
        }
        setError(null);
        startTransition(async () => {
          const result = await createLoanAction(fd);
          if (result && "ok" in result && result.ok === false) {
            setError(result.error);
          }
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2 p-1 bg-(--background) rounded-xl">
        <button
          type="button"
          onClick={() => setKind("lent")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition",
            kind === "lent"
              ? "bg-(--income) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          <JtIcon name="arrow-up-right" size={16} />
          {t("loans.directionLent")}
        </button>
        <button
          type="button"
          onClick={() => setKind("borrowed")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition",
            kind === "borrowed"
              ? "bg-(--expense) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          <JtIcon name="arrow-down-left" size={16} />
          {t("loans.directionBorrowed")}
        </button>
      </div>

      <input
        name="counterparty"
        type="text"
        required
        maxLength={120}
        placeholder={t("loans.counterpartyPlaceholder")}
        className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("loans.principalLabel", { currency })}
          </label>
          <input
            name="principal"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("accounts.currencyLabel")}
          </label>
          <CurrencyPicker
            value={currency}
            onChange={setCurrency}
            ariaLabel={t("accounts.currencyLabel")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("loans.startedAtLabel")}
          </label>
          <input
            ref={startedRef}
            name="startedAt"
            type="datetime-local"
            required
            suppressHydrationWarning
            className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("loans.dueDateLabel")}
          </label>
          <input
            name="dueDate"
            type="date"
            className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
          />
        </div>
      </div>

      <input
        name="note"
        type="text"
        maxLength={500}
        placeholder={t("loans.notePlaceholder")}
        className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
      />

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) font-semibold text-sm disabled:opacity-50 cta-primary"
      >
        {pending ? t("common.creating") : t("loans.createButton")}
      </button>
    </form>
  );
}
