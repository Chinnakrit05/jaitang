"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Tap-to-edit amount cell used by the monthly-report rows. The display
 * is a plain number; on focus the surrounding row gets a subtle ring
 * and the field becomes a regular `<input>`. We call the action on
 * blur or Enter — losing focus is the cheapest "I'm done" signal on
 * mobile.
 */
export function InlineAmount({
  initial,
  currency = "THB",
  action,
}: {
  initial: number;
  currency?: string;
  action: (amount: number) => Promise<Result>;
}) {
  const [value, setValue] = useState<string>(String(initial));
  const [savedValue, setSavedValue] = useState<number>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function commit() {
    setError(null);
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      // Revert to last good value silently.
      setValue(String(savedValue));
      return;
    }
    if (num === savedValue) return;
    startTransition(async () => {
      const result = await action(num);
      if (result.ok) {
        setSavedValue(num);
      } else {
        setError(result.error);
        setValue(String(savedValue));
      }
    });
  }

  // Format currency prefix — keep it tiny so the input stays close to
  // the number for tap-targeting on mobile.
  const symbol = currency === "THB" ? "฿" : currency;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-0.5 tabular-nums",
        pending && "opacity-60"
      )}
      title={error ?? undefined}
    >
      <span className="text-(--muted) text-xs">{symbol}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setValue(String(savedValue));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        size={Math.max(3, value.length)}
        className={cn(
          "bg-transparent text-right font-semibold tabular-nums focus:outline-none focus:bg-(--card) focus:px-1 focus:rounded transition",
          error ? "text-(--expense)" : "text-(--foreground)"
        )}
      />
    </span>
  );
}
