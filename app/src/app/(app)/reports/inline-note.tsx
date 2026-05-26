"use client";

import { useState, useTransition } from "react";
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
}: {
  initial: string;
  /** Shown when the stored note is empty — usually the category name. */
  placeholder?: string;
  action: (note: string) => Promise<Result>;
}) {
  const [value, setValue] = useState<string>(initial);
  const [savedValue, setSavedValue] = useState<string>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <input
      type="text"
      maxLength={500}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setValue(savedValue);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      title={error ?? undefined}
      className={cn(
        "w-full bg-transparent font-semibold text-[13px] leading-tight truncate focus:outline-none focus:bg-(--card) focus:px-1 focus:rounded transition",
        pending && "opacity-60",
        error ? "text-(--expense)" : "text-(--foreground)"
      )}
    />
  );
}
