"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn, toLocalDateTimeInput } from "@/lib/utils";
import { createTripAction } from "@/app/(app)/trips/actions";
import { CurrencyPicker } from "@/components/currency-picker";

const ICON_CHOICES = ["✈️", "🏖️", "🏔️", "🍜", "🎉", "🎒", "🚗", "🛳️", "🏕️", "🎁"];
const COLOR_CHOICES = [
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

export function CreateTripForm({ ledgerCurrency }: { ledgerCurrency: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  // Default to ledger currency — most trips are domestic.
  const [currency, setCurrency] = useState(ledgerCurrency);

  // Same client-side TZ trick we use on the transaction form: SSR with no
  // value, then fill in via ref on mount so the prefilled date is in the
  // user's local TZ rather than the server's UTC.
  const startsRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = startsRef.current;
    if (el && !el.value) {
      el.value = toLocalDateTimeInput(new Date().toISOString());
    }
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("icon", icon);
        fd.set("color", color);
        fd.set("currency", currency);
        // Convert TZ-naive datetime-local strings to UTC ISO before submit
        // (same reason as transaction-form.tsx).
        for (const k of ["startsAt", "endsAt"]) {
          const raw = fd.get(k);
          if (typeof raw === "string" && raw) {
            const inst = new Date(raw);
            if (!Number.isNaN(inst.getTime())) {
              fd.set(k, inst.toISOString());
            }
          }
        }
        setError(null);
        startTransition(async () => {
          const result = await createTripAction(fd);
          if (result && "ok" in result && result.ok === false) {
            setError(result.error);
          }
        });
      }}
      className="space-y-3"
    >
      <input
        name="name"
        type="text"
        required
        maxLength={80}
        placeholder={t("trips.namePlaceholder")}
        className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
      />

      <div>
        <div className="text-xs text-(--muted) mb-1.5">{t("trips.iconLabel")}</div>
        <div className="flex flex-wrap gap-1.5">
          {ICON_CHOICES.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={cn(
                "h-9 w-9 rounded-lg border text-lg flex items-center justify-center transition",
                icon === ic
                  ? "border-(--accent) bg-(--accent)/10"
                  : "border-(--border) bg-(--background) hover:bg-(--card)"
              )}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-(--muted) mb-1.5">{t("trips.colorLabel")}</div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              style={{ backgroundColor: c }}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition",
                color === c ? "border-(--foreground)" : "border-transparent"
              )}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-(--muted) mb-1.5">
          {t("trips.currencyLabel")}
        </div>
        <CurrencyPicker
          value={currency}
          onChange={setCurrency}
          ariaLabel={t("trips.currencyLabel")}
        />
        <p className="text-xs text-(--muted) mt-1">
          {t("trips.currencyHint")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("trips.startDate")}
          </label>
          <input
            ref={startsRef}
            name="startsAt"
            type="datetime-local"
            suppressHydrationWarning
            className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("trips.endDate")}
          </label>
          <input
            name="endsAt"
            type="datetime-local"
            className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
      >
        {pending ? t("common.creating") : t("trips.createButton")}
      </button>
    </form>
  );
}
