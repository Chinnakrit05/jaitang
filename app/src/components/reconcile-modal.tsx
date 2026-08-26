"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { reconcileAccountAction } from "@/app/(app)/accounts/actions";
import { formatCurrency, toLocalDateTimeInput } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

type Result = {
  computed: number;
  expected: number;
  diff: number;
  currency: string;
  committed: boolean;
};

/**
 * Reconcile flow:
 *   1. User picks "as of" + types their actual bank balance.
 *   2. Submit (commit=false) → server returns computed + diff. We
 *      show the comparison.
 *   3. If diff != 0, user clicks "Apply adjustment" → submit again
 *      with commit=true → server creates the adjustment tx.
 *   4. Success state shows ✓ then auto-closes after a beat.
 */
export function ReconcileModal({
  accountId,
  accountCurrency,
}: {
  accountId: string;
  accountCurrency: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [expected, setExpected] = useState("");
  const [asOf, setAsOf] = useState("");
  const dateRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setError(null);
    setResult(null);
    setExpected("");
    const now = toLocalDateTimeInput(new Date());
    setAsOf(now);
    if (dateRef.current) dateRef.current.value = now;
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function preview() {
    setError(null);
    const fd = new FormData();
    fd.set("expectedBalance", expected);
    fd.set("asOf", new Date(asOf).toISOString());
    fd.set("commit", "false");
    startTransition(async () => {
      const res = await reconcileAccountAction(accountId, fd);
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      setResult({
        computed: res.computed,
        expected: res.expected,
        diff: res.diff,
        currency: res.currency,
        committed: res.committed,
      });
    });
  }

  function commit() {
    setError(null);
    const fd = new FormData();
    fd.set("expectedBalance", expected);
    fd.set("asOf", new Date(asOf).toISOString());
    fd.set("commit", "true");
    startTransition(async () => {
      const res = await reconcileAccountAction(accountId, fd);
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      setResult({
        computed: res.computed,
        expected: res.expected,
        diff: res.diff,
        currency: res.currency,
        committed: res.committed,
      });
      router.refresh();
      // Auto-close after success.
      setTimeout(() => setOpen(false), 1400);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-[12px] soft-raised-sm hover:bg-(--background) text-sm font-medium transition"
        title={t("reconcile.button")}
      >
        <JtIcon name="scale-domain" size={18} />
        <span className="hidden sm:inline">{t("reconcile.button")}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,440px)] rounded-2xl soft-raised-sm shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <JtIcon name="scale-domain" size={22} className="text-(--accent)" />
                {t("reconcile.title")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-(--muted) hover:bg-(--background)"
                aria-label="close"
              >
                <JtIcon name="x" size={22} />
              </button>
            </div>

            <p className="text-xs text-(--muted) mb-4">
              {t("reconcile.help")}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-(--muted) mb-1">
                  {t("reconcile.asOfLabel")}
                </label>
                <input
                  ref={dateRef}
                  type="datetime-local"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-(--muted) mb-1">
                  {t("reconcile.expectedLabel", {
                    currency: accountCurrency,
                  })}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm tabular-nums"
                />
              </div>

              {/* Preview the diff after first submit */}
              {result && (
                <div
                  className={`rounded-xl p-3 border ${
                    result.diff === 0
                      ? "border-(--income)/30 bg-(--income)/5"
                      : "border-(--accent)/30 bg-(--accent)/5"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-(--muted)">
                      {t("reconcile.computedLabel")}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(
                        result.computed,
                        result.currency,
                        fmtLocale
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-(--muted)">
                      {t("reconcile.expectedShort")}
                    </span>
                    <span className="tabular-nums">
                      {formatCurrency(
                        result.expected,
                        result.currency,
                        fmtLocale
                      )}
                    </span>
                  </div>
                  <div className="border-t border-(--border) mt-2 pt-2 flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1">
                      {result.diff === 0 ? (
                        <>
                          <JtIcon name="check-circle-2"
                            size={18}
                            className="text-(--income)"
                          />
                          {t("reconcile.matchLabel")}
                        </>
                      ) : (
                        <>
                          <JtIcon name="alert-triangle"
                            size={18}
                            className="text-(--accent)"
                          />
                          {t("reconcile.diffLabel")}
                        </>
                      )}
                    </span>
                    <span
                      className={`text-lg font-bold tabular-nums ${
                        result.diff > 0
                          ? "text-(--income)"
                          : result.diff < 0
                          ? "text-(--expense)"
                          : "text-(--income)"
                      }`}
                    >
                      {result.diff > 0 ? "+" : result.diff < 0 ? "−" : ""}
                      {formatCurrency(
                        Math.abs(result.diff),
                        result.currency,
                        fmtLocale
                      )}
                    </span>
                  </div>
                  {result.committed && (
                    <p className="mt-2 text-xs text-(--income) flex items-center gap-1">
                      <JtIcon name="check-circle-2" size={16} />
                      {t("reconcile.committed")}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 px-4 py-2 rounded-[16px] soft-raised hover:bg-(--background) text-sm font-medium disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                {!result || result.diff === 0 || result.committed ? (
                  <button
                    type="button"
                    onClick={preview}
                    disabled={pending || !expected || !asOf}
                    className="flex-[2] px-4 py-2 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
                  >
                    {pending
                      ? t("common.saving")
                      : t("reconcile.checkButton")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={commit}
                    disabled={pending}
                    className="flex-[2] px-4 py-2 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
                  >
                    {pending
                      ? t("common.saving")
                      : t("reconcile.applyButton")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
