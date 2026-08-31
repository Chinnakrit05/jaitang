"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

/**
 * The note a recurring row carries for the month on screen.
 *
 * It sits on the title line as a chip, so a row keeps its height
 * whether or not it is annotated — the reports page is a dense monthly
 * sheet and notes are the exception, not the rule.
 *
 * Deliberately NOT the same field as the row's title: that one edits
 * the rule's own note and every month shares it. This one is filed
 * under "YYYY-MM", so May can say "จ่ายรวมค่าน้ำ 2 เดือน" while June
 * says nothing at all.
 *
 * Tap to edit, Enter or blur commits, Esc reverts — the same language
 * as <InlineNote> and <InlineAmount> beside it. Clearing the text
 * removes the note and the chip goes back to its "+" state.
 */
export function MonthNoteChip({
  initial,
  action,
}: {
  initial: string;
  action: (note: string) => Promise<Result>;
}) {
  const t = useTranslations();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    setError(null);
    if (value === saved) return;
    startTransition(async () => {
      const result = await action(value);
      if (result.ok) setSaved(value);
      else {
        setError(result.error);
        setValue(saved);
      }
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        maxLength={500}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setValue(saved);
            setEditing(false);
          }
        }}
        placeholder={t("reports.monthNote.placeholder")}
        className="min-w-0 flex-1 max-w-[168px] rounded-full bg-(--card) border border-(--accent) px-2 py-[1px] text-[10px] leading-5 text-(--foreground) focus:outline-none"
      />
    );
  }

  // An annotated month wears its note; an empty one is just a quiet
  // glyph. The dashed "+ หมายเหตุ" pill this replaced was wider than
  // most of the notes it was offering to hold, on every row that had
  // none — which is most rows, most months.
  if (!saved) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={pending}
        title={error ?? undefined}
        aria-label={t("reports.monthNote.add")}
        className={cn(
          // The box is 24px so it can be tapped; the mark inside is
          // 14px so it stays out of the way. -my-1 keeps the taller
          // hit area from growing the row.
          "shrink-0 -my-1 h-6 w-6 inline-flex items-center justify-center rounded-md transition",
          error ? "text-(--expense)" : "text-(--muted) opacity-55",
          pending && "opacity-40"
        )}
      >
        <JtIcon name="file-text" size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      title={error ?? saved}
      className={cn(
        // -my-1 for the same reason as the empty state's hit box: the
        // chip is taller than the 13px title beside it, and without
        // this an annotated row stands 6px taller than its neighbours.
        "shrink min-w-0 max-w-[132px] -my-1 inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[10px] leading-5 transition",
        "bg-(--peach-soft) text-(--peach-fg)",
        pending && "opacity-60",
        error && "bg-transparent border border-(--expense) text-(--expense)"
      )}
    >
      <span className="truncate">{saved}</span>
    </button>
  );
}
