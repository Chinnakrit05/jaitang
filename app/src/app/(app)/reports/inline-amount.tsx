"use client";

import { useEffect, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
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
  placeholder = "0",
  action,
}: {
  /** Pass null when there's no current amount (e.g. variable-cost
   *  recurring rule waiting for input). The field renders empty with
   *  the placeholder, and committing sends the typed value to `action`. */
  initial: number | null;
  currency?: string;
  placeholder?: string;
  action: (amount: number) => Promise<Result>;
}) {
  const [value, setValue] = useState<string>(initial === null ? "" : String(initial));
  const [savedValue, setSavedValue] = useState<number | null>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Flash a checkmark for ~1.2s after a successful save so the user
  // has a clear "yes, it landed" signal even when the visible row
  // state doesn't change much (variable-cost recurring rules in
  // particular don't store the just-typed amount on the rule).
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), 1200);
    return () => window.clearTimeout(id);
  }, [justSaved]);

  function commit() {
    setError(null);
    if (value === "") {
      // Empty + already empty → nothing to commit. Empty + had a saved
      // value → revert (we don't support "clear amount" through this
      // control; the long form handles deletes).
      if (savedValue !== null) setValue(String(savedValue));
      return;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      // Revert to last good value silently.
      setValue(savedValue === null ? "" : String(savedValue));
      return;
    }
    if (num === savedValue) return;
    startTransition(async () => {
      const result = await action(num);
      if (result.ok) {
        setSavedValue(num);
        setJustSaved(true);
      } else {
        setError(result.error);
        setValue(savedValue === null ? "" : String(savedValue));
      }
    });
  }

  // Format currency prefix — keep it tiny so the input stays close to
  // the number for tap-targeting on mobile.
  const symbol = currency === "THB" ? "฿" : currency;
  // When the field has no committed value yet, surface a dashed pill
  // so the user can tell at a glance that the row is awaiting input.
  // Once they commit a number, fall back to the seamless text look.
  const emptyState = savedValue === null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-0.5 tabular-nums transition",
        emptyState &&
          "border border-dashed border-(--accent)/60 rounded-md px-1.5 py-0.5 bg-(--accent)/5"
      )}
      title={error ?? undefined}
    >
      <span className="text-(--muted) text-xs">{symbol}</span>
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setValue(savedValue === null ? "" : String(savedValue));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        size={Math.max(3, value.length)}
        disabled={pending}
        className={cn(
          "bg-transparent text-right font-semibold tabular-nums text-[13px] focus:outline-none focus:bg-(--card) focus:px-1 focus:rounded transition",
          error ? "text-(--expense)" : "text-(--foreground)",
          emptyState && "placeholder:text-(--accent)/70",
          pending && "opacity-60"
        )}
      />
      {/* Inline status indicator — spinning loader while the action is
          in flight, brief check after a successful save. Sits flush
          with the input so the row height stays the same. */}
      {pending ? (
        <JtIcon
          name="loader-2"
          size={14}
          className="ml-0.5 animate-spin text-(--accent)"
          aria-label="saving"
        />
      ) : justSaved ? (
        <JtIcon
          name="check"
          size={14}
          className="ml-0.5 text-(--income)"
          aria-label="saved"
        />
      ) : null}
    </span>
  );
}
