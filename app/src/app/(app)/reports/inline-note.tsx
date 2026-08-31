"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Tap-to-edit primary-line text on report rows. Same UX language as
 * `<InlineAmount>` — blur or Enter commits, Esc reverts. Empty submit
 * is treated as "clear the note" and the server falls back to the
 * category name on next render.
 */
export function InlineNote({
  initial,
  placeholder,
  action,
  hug,
}: {
  initial: string;
  /** Shown when the stored note is empty — usually the category name. */
  placeholder?: string;
  action: (note: string) => Promise<Result>;
  /** Render as text that ends where the words end, becoming an input
   *  only once tapped. An <input> is always its `size` wide whatever it
   *  holds, which parks anything sitting after it — the month-note chip
   *  on recurring rows — way out to the right of a short name. */
  hug?: boolean;
}) {
  const [value, setValue] = useState<string>(initial);
  const [savedValue, setSavedValue] = useState<string>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setError(null);
    if (value === savedValue) return;
    startTransition(async () => {
      const result = await action(value);
      if (result.ok) {
        setSavedValue(value);
      } else {
        setError(result.error);
        setValue(savedValue);
      }
    });
  }

  if (hug && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={error ?? undefined}
        className={cn(
          "min-w-0 shrink max-w-full text-left font-semibold text-[13px] leading-tight truncate transition",
          pending && "opacity-60",
          error ? "text-(--expense)" : "text-(--foreground)"
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      maxLength={500}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        commit();
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setValue(savedValue);
          setEditing(false);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      title={error ?? undefined}
      className={cn(
        // Placeholder (the category-name fallback when a row has no note)
        // renders in the same dark foreground as a real note — the title
        // line is always the strong primary colour, never a faded hint.
        "w-full bg-transparent font-semibold text-[13px] leading-tight truncate focus:outline-none focus:bg-(--card) focus:px-1 focus:rounded transition placeholder:text-(--foreground) placeholder:opacity-100",
        pending && "opacity-60",
        error ? "text-(--expense)" : "text-(--foreground)"
      )}
    />
  );
}
