"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { createReportTransactionAction } from "./actions";

/**
 * "+" row at the bottom of each income / expense section on the monthly
 * report. Tapping the row reveals a name input followed by an amount
 * input; commit fires when the amount field blurs (or Enter) and creates
 * a transaction at Bangkok noon on day 1 of the viewed month with no
 * category (renders as "ไม่ระบุ"). The name flows into the tx's note so
 * the row reads cleanly once it reappears in the list above via
 * revalidatePath.
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
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLLIElement | null>(null);

  // Auto-focus the name input the first frame after the row expands so
  // the user can start typing the line item title right away — amount
  // is filled on the next field.
  useEffect(() => {
    if (!open) return;
    nameRef.current?.focus();
  }, [open]);

  function reset() {
    setOpen(false);
    setName("");
    setAmount("");
    setError(null);
  }

  function commit() {
    const num = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(num) || num <= 0) {
      // No amount typed — collapse without saving so the row is "+"
      // again. Name alone isn't enough to materialise a tx (DB requires
      // a positive amount).
      reset();
      return;
    }
    startTransition(async () => {
      const result = await createReportTransactionAction({
        kind,
        year,
        month,
        amount: num,
        note: name.trim() || undefined,
      });
      if (result.ok) {
        reset();
      } else {
        setError(result.error);
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
            {t("dashboard.addTransaction")}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li
      ref={rootRef}
      className="flex items-center gap-2 px-3 py-1.5"
      onBlur={(e) => {
        // Commit only when focus leaves the entire row — tabbing from
        // name → amount must keep the row open.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        commit();
      }}
    >
      <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-(--accent)/10 text-(--accent)">
        <JtIcon name="plus-fab" size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <input
          ref={nameRef}
          type="text"
          autoComplete="off"
          placeholder={t("categories.uncategorized")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              amountRef.current?.focus();
            }
            if (e.key === "Escape") {
              reset();
            }
          }}
          disabled={pending}
          className={cn(
            "w-full bg-transparent text-[13px] font-medium focus:outline-none placeholder:text-(--muted) text-(--foreground)",
            pending && "opacity-60"
          )}
        />
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
          ref={amountRef}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              reset();
            }
          }}
          size={Math.max(3, amount.length)}
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
