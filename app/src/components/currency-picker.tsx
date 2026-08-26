"use client";

import { ALL_CURRENCIES, PINNED_COUNT } from "@/lib/currencies";
import { cn } from "@/lib/utils";

/**
 * Shared currency dropdown. Pinned popular Thai-tourist destinations
 * appear first, followed by an `── Other ──` divider, then the rest in
 * alphabetical order. Used in trip forms and the transaction form.
 */
export function CurrencyPicker({
  value,
  onChange,
  name,
  className,
  disabled = false,
  ariaLabel,
}: {
  value: string;
  onChange: (code: string) => void;
  /** When set, also renders a hidden `<input>` so plain `<form>` submits work. */
  name?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "px-2 py-2 rounded-[12px] soft-raised-sm text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)/40 disabled:opacity-50",
          className
        )}
      >
        {ALL_CURRENCIES.slice(0, PINNED_COUNT).map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
        {/* Some browsers don't render a styled <option> separator — the
            em-dash visual is the best we can do here. */}
        <option disabled value="__divider__">
          ── Other ──
        </option>
        {ALL_CURRENCIES.slice(PINNED_COUNT).map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
