"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { createGoalAction } from "@/app/(app)/goals/actions";
import { JtIcon, type IconName } from "@/components/icons";

const ICON_CHOICES: IconName[] = [
  "bullseye",
  "airplane",
  "beach",
  "house",
  "car",
  "ring",
  "graduation-cap",
  "laptop",
  "game-controller",
  "shopping-cart",
];
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

export function CreateGoalForm({ ledgerCurrency }: { ledgerCurrency: string }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("icon", icon);
        fd.set("color", color);
        // Convert TZ-naive deadline (datetime-local input) to UTC ISO so
        // the server doesn't reinterpret in its own TZ. Same pattern as
        // the transaction-form — see comment there for the longer write-up.
        const raw = fd.get("deadline");
        if (typeof raw === "string" && raw) {
          const inst = new Date(raw);
          if (!Number.isNaN(inst.getTime())) {
            fd.set("deadline", inst.toISOString());
          }
        }
        setError(null);
        startTransition(async () => {
          const result = await createGoalAction(fd);
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
        placeholder={t("goals.namePlaceholder")}
        className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("goals.targetLabel", { currency: ledgerCurrency })}
          </label>
          <input
            name="targetAmount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            placeholder="100000"
            className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent) tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-(--muted) mb-1">
            {t("goals.deadlineLabelOptional")}
          </label>
          <input
            name="deadline"
            type="datetime-local"
            className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
          />
        </div>
      </div>

      <div>
        <div className="text-xs text-(--muted) mb-1.5">{t("goals.iconLabel")}</div>
        <div className="flex flex-wrap gap-1.5">
          {ICON_CHOICES.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={cn(
                "h-9 w-9 rounded-lg border flex items-center justify-center transition",
                icon === ic
                  ? "border-(--accent) bg-(--accent)/10"
                  : "border-(--border) bg-(--background) hover:bg-(--card)"
              )}
            >
              <JtIcon name={ic} size={22} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs text-(--muted) mb-1.5">{t("goals.colorLabel")}</div>
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
        {pending ? t("common.creating") : t("goals.createButton")}
      </button>
    </form>
  );
}
