"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  parseReportImageAction,
  commitImportedTransactionsAction,
  type ParsedRow,
} from "./import-image";

/**
 * "Import from image" entry point for the monthly report header. Flow:
 *   1. tap → native file/camera picker
 *   2. upload → Claude vision extracts {name, amount, kind} rows
 *   3. preview modal: edit names/amounts, flip income↔expense, untick
 *      any junk rows
 *   4. confirm → bulk-insert into the viewed month
 *
 * Everything lands in `year`/`month` (the month the user is looking at),
 * so importing while viewing April puts the rows in April.
 */

type DraftRow = ParsedRow & { include: boolean };

export function ImportImageButton({
  year,
  month,
  currency,
}: {
  year: number;
  month: number;
  currency: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [parsing, startParse] = useTransition();
  const [committing, startCommit] = useTransition();
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const symbol = currency === "THB" ? "฿" : currency;

  useEffect(() => {
    if (rows === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rows]);

  function close() {
    setRows(null);
    setError(null);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still fires change.
    e.target.value = "";
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("image", file);
    startParse(async () => {
      const result = await parseReportImageAction(fd);
      if (result.ok) {
        setRows(result.rows.map((r) => ({ ...r, include: true })));
      } else {
        setError(result.error);
      }
    });
  }

  function patch(i: number, next: Partial<DraftRow>) {
    setRows((prev) =>
      prev ? prev.map((r, idx) => (idx === i ? { ...r, ...next } : r)) : prev
    );
  }

  function confirm() {
    if (!rows) return;
    const chosen = rows
      .filter((r) => r.include && r.name.trim() && r.amount > 0)
      .map(({ name, amount, kind }) => ({ name: name.trim(), amount, kind }));
    if (chosen.length === 0) {
      setError(t("reports.import.noneSelected"));
      return;
    }
    startCommit(async () => {
      const result = await commitImportedTransactionsAction({ year, month, rows: chosen });
      if (result.ok) {
        close();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const selectedCount = rows?.filter((r) => r.include).length ?? 0;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={parsing}
        aria-label={t("reports.import.button")}
        title={t("reports.import.button")}
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium transition disabled:opacity-60"
      >
        {parsing ? (
          <JtIcon name="loader-2" size={18} className="animate-spin" />
        ) : (
          <JtIcon name="scan-line" size={18} />
        )}
        <span className="hidden sm:inline">{t("reports.import.button")}</span>
      </button>

      {error && rows === null && (
        <span className="text-xs text-(--expense) max-w-[40vw] truncate" title={error}>
          {error}
        </span>
      )}

      {rows !== null && (
        <>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,460px)] max-h-[88vh] flex flex-col rounded-2xl bg-(--card) border border-(--border) shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="font-semibold text-lg">{t("reports.import.title")}</h2>
              <button
                type="button"
                onClick={close}
                className="p-1.5 rounded-lg text-(--muted) hover:bg-(--background)"
                aria-label={t("common.close")}
              >
                <JtIcon name="x" size={22} />
              </button>
            </div>

            <p className="px-5 pb-2 text-xs text-(--muted)">
              {t("reports.import.reviewHint")}
            </p>

            <ul className="flex-1 overflow-y-auto px-3 divide-y divide-(--border)/60">
              {rows.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 transition",
                    !r.include && "opacity-40"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => patch(i, { include: !r.include })}
                    aria-label={r.include ? t("common.clear") : t("common.confirm")}
                    className={cn(
                      "h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition",
                      r.include
                        ? "border-(--accent) bg-(--accent) text-(--accent-foreground)"
                        : "border-(--border) bg-(--background)"
                    )}
                  >
                    {r.include && <JtIcon name="check" size={14} />}
                  </button>

                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    placeholder={t("common.uncategorized")}
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium focus:outline-none placeholder:text-(--muted)"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      patch(i, { kind: r.kind === "expense" ? "income" : "expense" })
                    }
                    className={cn(
                      "shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-md border transition",
                      r.kind === "income"
                        ? "border-(--income)/40 text-(--income) bg-(--income)/10"
                        : "border-(--expense)/40 text-(--expense) bg-(--expense)/10"
                    )}
                    title={t("reports.import.toggleKind")}
                  >
                    {r.kind === "income" ? t("common.incomeShort") : t("common.expenseShort")}
                  </button>

                  <span className="shrink-0 inline-flex items-center gap-0.5">
                    <span className="text-(--muted) text-xs">{symbol}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={r.amount}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/[^\d.]/g, ""));
                        patch(i, { amount: Number.isFinite(n) ? n : 0 });
                      }}
                      size={Math.max(4, String(r.amount).length)}
                      className="bg-transparent text-right font-semibold tabular-nums text-sm focus:outline-none w-20"
                    />
                  </span>
                </li>
              ))}
            </ul>

            {error && (
              <div className="mx-5 mt-3 rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 p-5 pt-3 border-t border-(--border)/60">
              <button
                type="button"
                onClick={close}
                disabled={committing}
                className="flex-1 px-4 py-2.5 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={committing || selectedCount === 0}
                className="flex-[2] px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary inline-flex items-center justify-center gap-1.5"
              >
                {committing && <JtIcon name="loader-2" size={16} className="animate-spin" />}
                {committing
                  ? t("common.saving")
                  : t("reports.import.addCount", { count: selectedCount })}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
