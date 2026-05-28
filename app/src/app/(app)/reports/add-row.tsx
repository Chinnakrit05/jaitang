"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { createReportTransactionAction } from "./actions";

/**
 * "+" row at the bottom of each income / expense section on the monthly
 * report. Tapping the row reveals an inline amount input; on commit the
 * row inserts a new transaction at Bangkok noon on day 1 of the viewed
 * month with no category ("ไม่ระบุ"). After a successful save the input
 * collapses back to the "+" affordance — the just-added row appears in
 * the list above via revalidatePath.
 */
export function AddRow({
  kind,
  year,
  month,
  currency,
}: {
  kind: "income" | "expense";
  year: number;
  month: number;
  currency: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus the input the first frame after the row expands so the
  // user can type without a second tap.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  function reset() {
    setOpen(false);
    setValue("");
    setError(null);
  }

  function commit() {
    const num = Number(value.replace(/,/g, ""));
    if (!Number.isFinite(num) || num <= 0) {
      reset();
      return;
    }
    startTransition(async () => {
      const result = await createReportTransactionAction({
        kind,
        year,
        month,
        amount: num,
      });
      if (result.ok) {
        reset();
      } else {
        setError(result.error);
        setValue("");
      }
    });
  }

  const symbol = currency === "THB" ? "฿" : currency;

  if (!open) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-(--accent) hover:bg-(--accent)/5 transition"
        >
          <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-(--accent)/10">
            <JtIcon name="plus-fab" size={14} />
          </span>
          <span className="flex-1 min-w-0 text-left text-[13px] font-medium">
            {t("transactions.addTransaction")}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li
      className="flex items-center gap-2 px-3 py-1.5"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        commit();
      }}
    >
      <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-(--accent)/10 text-(--accent)">
        <JtIcon name="plus-fab" size={14} />
      </span>
      <div className="flex-1 min-w-0 text-[13px] text-(--muted)">
        {t("categories.uncategorized")}
      </div>
      <span
        className={cn(
          "inline-flex items-center justify-end gap-0.5 tabular-nums transition",
          "border border-dashed border-(--accent)/60 rounded-md px-1.5 py-0.5 bg-(--accent)/5"
        )}
        title={error ?? undefined}
      >
        <span className="text-(--muted) text-xs">{symbol}</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          autoComplete="off"
          placeholder="0"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              reset();
            }
          }}
          size={Math.max(3, value.length)}
          disabled={pending}
          className={cn(
            "bg-transparent text-right font-semibold tabular-nums text-[13px] focus:outline-none text-(--foreground) placeholder:text-(--accent)/70",
            error && "text-(--expense)",
            pending && "opacity-60"
          )}
        />
        {pending && (
          <JtIcon
            name="loader-2"
            size={14}
            className="ml-0.5 animate-spin text-(--accent)"
            aria-label="saving"
          />
        )}
      </span>
    </li>
  );
}
