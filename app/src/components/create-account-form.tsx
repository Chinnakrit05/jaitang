"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CurrencyPicker } from "@/components/currency-picker";
import { createAccountAction } from "@/app/(app)/accounts/actions";
import type { AccountType } from "@/lib/types";

const TYPES: AccountType[] = ["cash", "bank", "credit_card", "e_wallet"];
const ICON_CHOICES = ["💵", "🏦", "💳", "📱", "💰", "👛", "🏧", "🪙"];
const COLOR_CHOICES = [
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
  "#64748b",
];

export function CreateAccountForm({
  ledgerCurrency,
}: {
  ledgerCurrency: string;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<AccountType>("cash");
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [currency, setCurrency] = useState(ledgerCurrency);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("type", type);
        fd.set("icon", icon);
        fd.set("color", color);
        fd.set("currency", currency);
        setError(null);
        startTransition(async () => {
          const result = await createAccountAction(fd);
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
        placeholder={t("accounts.namePlaceholder")}
        className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
      />

      <div>
        <div className="text-xs text-(--muted) mb-1.5">
          {t("accounts.typeLabel")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setType(tp)}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm font-medium transition",
                type === tp
                  ? "border-(--accent) bg-(--accent)/10 text-(--foreground)"
                  : "border-(--border) bg-(--background) text-(--muted) hover:text-(--foreground)"
              )}
            >
              {t(`accounts.type.${tp}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("accounts.initialBalanceLabel")}
          </label>
          <input
            name="initialBalance"
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue="0"
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

      <div>
        <div className="text-xs text-(--muted) mb-1.5">
          {t("accounts.iconLabel")}
        </div>
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
        <div className="text-xs text-(--muted) mb-1.5">
          {t("accounts.colorLabel")}
        </div>
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
        {pending ? t("common.creating") : t("accounts.createButton")}
      </button>
    </form>
  );
}
