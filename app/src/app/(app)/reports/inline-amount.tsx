"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Tap-to-edit amount cell used by the monthly-report rows. The display
 * is a plain number; on focus the surrounding row gets a subtle ring
 * and the field becomes a regular `<input>`. We call the action on
 * blur or Enter — losing focus is the cheapest "I'm done" signal on
 * mobile.
 *
 * "Sum on the fly" — when the user is editing, a "+" button sits to
 * the left of the input. Tapping it prepends another input. The
 * committed amount is the sum of every addend, so the user can type
 * `50` `+` `100` instead of doing the math in their head. Extras
 * collapse back into the formatted total once commit fires.
 */
export function InlineAmount({
  initial,
  currency = "THB",
  placeholder = "0",
  action,
  onSkip,
  skipped: skippedProp = false,
}: {
  /** Pass null when there's no current amount (e.g. variable-cost
   *  recurring rule waiting for input). The field renders empty with
   *  the placeholder, and committing sends the typed value to `action`. */
  initial: number | null;
  currency?: string;
  placeholder?: string;
  action: (amount: number) => Promise<Result>;
  /** Optional "no value this period" handler. When provided, the
   *  user can type "-" to fire this instead of an amount commit —
   *  used by /reports + /recurring to skip a recurring rule's
   *  current period without leaving a 0-amount tx behind. */
  onSkip?: () => Promise<Result>;
  /** True when the row has already been marked skipped — renders
   *  the cell as "-" instead of a number on first paint. */
  skipped?: boolean;
}) {
  // Comma-formatted view of a numeric value — `1000` → `1,000`. Used
  // outside the edit cursor so the saved amount reads cleanly; while
  // the input is focused we drop back to the raw digits so the
  // caret behaviour stays predictable as the user types.
  const fmt = (n: number) =>
    Number.isInteger(n) ? n.toLocaleString("en-US") : String(n);
  // "Skipped" rows render the cell as "-" instead of a number. The
  // user marks one by typing "-" into the input when onSkip is wired.
  const [skipped, setSkipped] = useState<boolean>(skippedProp);
  const [value, setValue] = useState<string>(
    skippedProp ? "-" : initial === null ? "" : fmt(initial)
  );
  // Extra addends added via the "+" button. Each is an independent
  // input rendered to the left of the main one. Order: index 0 is
  // the leftmost (oldest "+" tap), main input sits to the right.
  const [extras, setExtras] = useState<string[]>([]);
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

  // Auto-focus the freshly-added extra input — the user just tapped
  // "+" and expects to type into it immediately.
  const extrasContainerRef = useRef<HTMLSpanElement | null>(null);
  const pendingFocusRef = useRef(false);
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const first = extrasContainerRef.current?.querySelector<HTMLInputElement>(
      "input[data-addend]"
    );
    first?.focus();
  }, [extras.length]);

  function commit() {
    setError(null);
    // "-" → skip this period and render as "-". Only honoured when
    // onSkip is wired (recurring rule rows).
    if (onSkip && value.trim() === "-" && extras.length === 0) {
      if (skipped) return; // already skipped, no-op
      startTransition(async () => {
        const result = await onSkip();
        if (result.ok) {
          setSkipped(true);
          setSavedValue(0);
          setValue("-");
          setJustSaved(true);
        } else {
          setError(result.error);
          setValue(savedValue === null ? "" : fmt(savedValue));
        }
      });
      return;
    }
    // Sum strips commas first. Allow 0 here — we'll branch below.
    const parsed = [...extras, value]
      .map((v) => Number(v.replace(/,/g, "")))
      .filter((n) => Number.isFinite(n) && n >= 0);
    if (parsed.length === 0) {
      // Nothing to commit — revert + collapse extras.
      setExtras([]);
      if (skipped) {
        setValue("-");
        return;
      }
      if (savedValue !== null) setValue(fmt(savedValue));
      else setValue("");
      return;
    }
    const num = parsed.reduce((s, n) => s + n, 0);
    if (!Number.isFinite(num) || num < 0) {
      setExtras([]);
      setValue(savedValue === null ? "" : fmt(savedValue));
      return;
    }
    if (num === savedValue && !skipped) {
      setExtras([]);
      setValue(fmt(num));
      return;
    }
    // 0 is a real commit on rule rows (onSkip wired) — it stores a
    // 0-amount override for the viewed month and renders as "฿0".
    // "-" is what marks the month as "no value" (the skipped path
    // above). For ordinary tx rows (no onSkip), 0 isn't valid: the
    // DB constraint forbids non-positive tx amounts, and the
    // transaction edit form is the right place to delete instead.
    if (!onSkip && num === 0) {
      setExtras([]);
      setValue(savedValue === null ? "" : fmt(savedValue));
      return;
    }
    startTransition(async () => {
      const result = await action(num);
      if (result.ok) {
        setSavedValue(num);
        setValue(fmt(num));
        setExtras([]);
        setJustSaved(true);
      } else {
        setError(result.error);
        setExtras([]);
        setValue(savedValue === null ? "" : fmt(savedValue));
      }
    });
  }

  // Format currency prefix — keep it tiny so the input stays close to
  // the number for tap-targeting on mobile.
  const symbol = currency === "THB" ? "฿" : currency;
  // When the field has no committed value yet, surface a dashed pill
  // so the user can tell at a glance that the row is awaiting input.
  // Once they commit a number, fall back to the seamless text look.
  const emptyState = savedValue === null && extras.length === 0;

  return (
    <span
      ref={extrasContainerRef}
      className={cn(
        "inline-flex items-center justify-end gap-0.5 tabular-nums transition",
        emptyState &&
          "border border-dashed border-(--accent)/60 rounded-md px-1.5 py-0.5 bg-(--accent)/5"
      )}
      title={error ?? undefined}
      onBlur={(e) => {
        // Commit when focus leaves the pill entirely — moving
        // between the addend inputs (and the "+" button) keeps the
        // commit at bay so the user can finish their math.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        commit();
      }}
    >
      {extras.map((v, i) => (
        <span
          key={`x-${i}`}
          className="inline-flex items-center gap-0.5 tabular-nums"
        >
          <span className="text-(--muted) text-xs">{symbol}</span>
          <input
            data-addend
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            autoComplete="off"
            placeholder="0"
            value={v}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d.]/g, "");
              setExtras((arr) => {
                const out = [...arr];
                out[i] = next;
                return out;
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setExtras([]);
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            size={Math.max(2, v.length)}
            disabled={pending}
            className={cn(
              "bg-transparent text-right font-semibold tabular-nums text-[13px] focus:outline-none focus:bg-(--card) focus:px-1 focus:rounded transition text-(--foreground)",
              pending && "opacity-60"
            )}
          />
          <span className="text-(--muted) text-xs">+</span>
        </span>
      ))}
      <button
        type="button"
        onClick={() => {
          pendingFocusRef.current = true;
          setExtras((arr) => ["", ...arr]);
        }}
        disabled={pending}
        aria-label="add"
        title="add"
        className="h-5 w-5 rounded-md flex items-center justify-center text-(--accent) hover:bg-(--accent)/10 transition disabled:opacity-50"
      >
        <JtIcon name="plus-fab" size={12} />
      </button>
      <span className="text-(--muted) text-xs">{symbol}</span>
      <input
        type="text"
        inputMode="decimal"
        // iOS Safari needs the legacy `pattern` hint alongside
        // `inputMode` to actually surface the decimal keypad.
        pattern="[0-9]*\.?[0-9]*"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          // Drop commas so the caret behaviour stays predictable
          // while the user types — re-formatted on blur. If the
          // cell was rendering "-" (skipped), clear it so the user
          // can start typing a fresh value.
          setValue((v) => {
            if (v === "-") return "";
            return v.replace(/,/g, "");
          });
        }}
        onChange={(e) => {
          // Allow a bare "-" so the user can mark "no value this
          // period" when onSkip is wired. For anything else we
          // strip non-digits.
          const raw = e.target.value;
          if (onSkip && raw.trim() === "-") {
            setValue("-");
            return;
          }
          // Typing a number overrides any prior skip flag.
          if (skipped) setSkipped(false);
          setValue(raw.replace(/[^\d.]/g, ""));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setExtras([]);
            setValue(
              skipped
                ? "-"
                : savedValue === null
                ? ""
                : fmt(savedValue)
            );
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
