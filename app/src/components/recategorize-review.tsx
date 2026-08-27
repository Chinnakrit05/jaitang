"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import {
  applyRecategorizeAction,
  proposeRecategorizeAction,
  type RecategorizeChange,
} from "@/app/(app)/transactions/recategorize-action";

type Row = RecategorizeChange & { keep: boolean };

/**
 * Review sheet for the AI re-file pass over one month.
 *
 * It only ever lists transactions that would actually move — anything
 * the model was unsure about, or agreed with, never reaches here. That
 * is the whole point: the user is asked to approve changes, not to
 * re-read a month of rows that are staying put.
 *
 * The proposal runs on open rather than behind a second tap; the button
 * that opened this is already the user saying "go".
 */
export function RecategorizeReview({
  ym,
  monthLabel,
  onClose,
}: {
  ym: string;
  monthLabel: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [applying, startApply] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await proposeRecategorizeAction(ym);
        if (cancelled) return;
        if (result.ok === false) setError(result.error);
        else {
          setScanned(result.scanned);
          setRows(result.changes.map((c) => ({ ...c, keep: true })));
        }
      } catch (err) {
        // The action resolves its own expected failures, so a rejection
        // here is a transport problem. Without this the sheet spins
        // forever and the user has no idea anything went wrong.
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ym]);

  const kept = rows.filter((r) => r.keep);

  function toggle(txId: string) {
    setRows((prev) =>
      prev.map((r) => (r.txId === txId ? { ...r, keep: !r.keep } : r))
    );
  }

  function apply() {
    setError(null);
    startApply(async () => {
      const result = await applyRecategorizeAction(
        kept.map((r) => ({ txId: r.txId, toId: r.toId }))
      );
      if (result.ok === false) {
        setError(
          result.applied > 0
            ? t("recategorize.appliedPartially", {
                count: result.applied,
                error: result.error,
              })
            : result.error
        );
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(94vw,520px)] max-h-[88vh] flex flex-col rounded-[26px] soft-raised-lg"
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-lg">{t("recategorize.title")}</h2>
            <p className="text-sm text-(--muted) mt-0.5 truncate">
              {loading
                ? t("recategorize.scanning", { month: monthLabel })
                : t("recategorize.summary", {
                    scanned,
                    changes: rows.length,
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="shrink-0 h-9 w-9 rounded-full soft-raised-sm soft-pressable flex items-center justify-center"
          >
            <JtIcon name="x" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-2.5">
          {loading && (
            <div className="py-10 flex flex-col items-center gap-3 text-sm text-(--muted)">
              <JtIcon name="loader-2" size={26} className="animate-spin" />
              {t("recategorize.scanning", { month: monthLabel })}
            </div>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-(--muted)">
              {t("recategorize.noChanges")}
            </p>
          )}

          {rows.map((row) => (
            <button
              key={row.txId}
              type="button"
              onClick={() => toggle(row.txId)}
              aria-pressed={row.keep}
              className={`w-full text-left rounded-[18px] px-3 py-2.5 transition ${
                row.keep ? "soft-raised-sm" : "soft-well-sm opacity-60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`shrink-0 h-5 w-5 rounded-md flex items-center justify-center ${
                    row.keep ? "bg-(--accent) text-(--accent-foreground)" : ""
                  }`}
                  aria-hidden
                >
                  {row.keep && <JtIcon name="check" size={13} />}
                </span>
                <span className="flex-1 min-w-0 text-[13px] font-medium truncate">
                  {row.note || t("recategorize.noNote")}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums">
                  ฿{row.amount.toLocaleString("th-TH")}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-2 pl-7 text-xs text-(--muted)">
                <span className="inline-flex items-center gap-1 min-w-0">
                  {row.fromIcon && (
                    <EmojiOrIcon value={row.fromIcon} size={13} />
                  )}
                  <span className="truncate">
                    {row.fromName ?? t("recategorize.unset")}
                  </span>
                </span>
                <JtIcon name="arrow-right" size={13} className="shrink-0" />
                <span className="inline-flex items-center gap-1 min-w-0 text-(--foreground) font-medium">
                  {row.toIcon && <EmojiOrIcon value={row.toIcon} size={13} />}
                  <span className="truncate">{row.toName}</span>
                </span>
                {row.confidence === "medium" && (
                  <span className="shrink-0 ml-auto text-[10px] px-1.5 py-0.5 rounded-full soft-well-sm">
                    {t("recategorize.maybe")}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="p-5 pt-3 space-y-2">
          {error && <p className="text-sm text-(--expense)">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-(--muted)">
              {t("recategorize.keptCount", { count: kept.length })}
            </span>
            <button
              type="button"
              onClick={apply}
              disabled={applying || loading || kept.length === 0}
              className="px-4 py-2 rounded-[16px] bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 transition"
            >
              {applying
                ? t("recategorize.applying")
                : t("recategorize.apply", { count: kept.length })}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
