"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { cn, formatCurrency, toLocalDateTimeInput } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { createTransferAction } from "@/app/(app)/accounts/actions";
import { getFxRateAction } from "@/app/(app)/transactions/fx-actions";

export type AccountChoice = {
  id: string;
  name: string;
  icon: string | null;
  currency: string;
};

/**
 * Cross-currency aware transfer form. Same-currency case is just
 * "fromAmount" → applied to both sides. When `from.currency !==
 * to.currency` we surface a "received amount" field that defaults to
 * the live FX-preview product but is editable, so the user can record
 * the exact figure their bank/Wise reported (which usually differs from
 * the rate after fees).
 *
 * The server re-validates and re-computes either way; this form just
 * makes the math visible while typing.
 */
export function CreateTransferForm({
  accounts,
  defaultFromId,
  homeCurrency,
}: {
  accounts: AccountChoice[];
  defaultFromId?: string;
  homeCurrency: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Default from-account: explicit prop > first non-archived account.
  const [fromId, setFromId] = useState<string>(
    defaultFromId ?? accounts[0]?.id ?? ""
  );
  // Default to-account: any account other than from. Pre-pick the
  // second one in the list so a single click on submit works for users
  // with two accounts.
  const [toId, setToId] = useState<string>(
    accounts.find((a) => a.id !== (defaultFromId ?? accounts[0]?.id))?.id ?? ""
  );
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  // Whether the user has manually overridden toAmount. Once they touch
  // it, FX preview stops auto-overwriting.
  const [toTouched, setToTouched] = useState(false);
  const [note, setNote] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>("");
  const dateRef = useRef<HTMLInputElement>(null);

  // Set local datetime default after mount (server-render TZ != client TZ).
  useEffect(() => {
    if (!occurredAt) {
      const now = toLocalDateTimeInput(new Date());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOccurredAt(now);
      if (dateRef.current) dateRef.current.value = now;
    }
  }, [occurredAt]);

  const fromAcc = accounts.find((a) => a.id === fromId) ?? null;
  const toAcc = accounts.find((a) => a.id === toId) ?? null;
  const fromCur = fromAcc?.currency ?? homeCurrency;
  const toCur = toAcc?.currency ?? homeCurrency;
  const isCrossCurrency = fromAcc && toAcc && fromCur !== toCur;
  const sameAccount = fromId && toId && fromId === toId;

  // FX preview: when cross-currency and the user hasn't typed their own
  // toAmount, fetch a rate and pre-fill the field with from*rate.
  const [previewRate, setPreviewRate] = useState<number | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  useEffect(() => {
    if (!isCrossCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewRate(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFxError(null);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFxLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFxError(null);
    let cancelled = false;
    (async () => {
      const result = await getFxRateAction(fromCur, toCur);
      if (cancelled) return;
      if (result.ok) {
        setPreviewRate(result.rate);
        setFxError(null);
      } else {
        setPreviewRate(null);
        setFxError(result.error);
      }
      setFxLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCrossCurrency, fromCur, toCur]);

  // Auto-fill toAmount from preview rate while user hasn't touched it.
  // We deliberately depend on previewRate + fromAmount so each edit
  // refreshes the suggestion. When the user types in toAmount manually,
  // setToTouched(true) breaks this loop.
  useEffect(() => {
    if (!isCrossCurrency || toTouched || !previewRate) return;
    const num = parseFloat(fromAmount);
    if (!Number.isFinite(num) || num <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToAmount("");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToAmount((num * previewRate).toFixed(2));
  }, [previewRate, fromAmount, isCrossCurrency, toTouched]);

  function submit() {
    setError(null);
    if (!fromId || !toId) {
      setError(t("transfers.errorPickAccounts"));
      return;
    }
    if (sameAccount) {
      setError(t("transfers.errorSameAccount"));
      return;
    }
    const fromNum = parseFloat(fromAmount);
    if (!Number.isFinite(fromNum) || fromNum <= 0) {
      setError(t("transfers.errorAmount"));
      return;
    }
    const fd = new FormData();
    fd.set("fromAccountId", fromId);
    fd.set("toAccountId", toId);
    fd.set("fromAmount", String(fromNum));
    if (isCrossCurrency && toAmount.trim()) {
      const toNum = parseFloat(toAmount);
      if (Number.isFinite(toNum) && toNum > 0) {
        fd.set("toAmount", String(toNum));
      }
    }
    if (note.trim()) fd.set("note", note.trim());
    // Pass occurredAt as ISO with offset — server schema expects datetime({ offset: true })
    fd.set("occurredAt", new Date(occurredAt).toISOString());

    startTransition(async () => {
      const result = await createTransferAction(fd);
      if (result && "ok" in result && result.ok === false) {
        setError(result.error);
        return;
      }
      router.push("/accounts");
    });
  }

  // Implicit rate from user-edited toAmount (Wise-style: include fees).
  const userImpliedRate =
    isCrossCurrency &&
    toAmount &&
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    parseFloat(toAmount) > 0
      ? parseFloat(toAmount) / parseFloat(fromAmount)
      : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      {/* From */}
      <div>
        <label className="block text-xs text-(--muted) mb-1">
          {t("transfers.fromLabel")}
        </label>
        <select
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
        >
          <option value="">— {t("transfers.fromLabel")} —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {(a.icon ?? "") + " "}
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </div>

      {/* From amount */}
      <div>
        <label className="block text-xs text-(--muted) mb-1">
          {t("transfers.fromAmountLabel", { currency: fromCur })}
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={fromAmount}
          onChange={(e) => setFromAmount(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      {/* Visual arrow */}
      <div className="flex items-center justify-center text-(--muted)">
        <ArrowRight size={16} />
      </div>

      {/* To */}
      <div>
        <label className="block text-xs text-(--muted) mb-1">
          {t("transfers.toLabel")}
        </label>
        <select
          value={toId}
          onChange={(e) => setToId(e.target.value)}
          className={cn(
            "w-full px-3 py-2 rounded-xl border bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)",
            sameAccount ? "border-(--expense)" : "border-(--border)"
          )}
        >
          <option value="">— {t("transfers.toLabel")} —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} disabled={a.id === fromId}>
              {(a.icon ?? "") + " "}
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
        {sameAccount && (
          <p className="mt-1 text-xs text-(--expense)">
            {t("transfers.errorSameAccount")}
          </p>
        )}
      </div>

      {/* Cross-currency: To amount + FX preview */}
      {isCrossCurrency && (
        <div className="rounded-xl border border-(--border) bg-(--background) p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-(--muted)">
              {t("transfers.toAmountLabel", { currency: toCur })}
            </label>
            {fxLoading && (
              <span className="text-[11px] text-(--muted)">
                {t("transfers.fxFetching")}
              </span>
            )}
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={toAmount}
            onChange={(e) => {
              setToAmount(e.target.value);
              setToTouched(true);
            }}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--card) text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-(--accent)"
          />
          {fxError ? (
            <p className="text-xs text-(--expense)">
              {t("transfers.fxError")} — {fxError}
            </p>
          ) : userImpliedRate !== null ? (
            <p className="text-[11px] text-(--muted)">
              {t("transfers.rateLine", {
                rate: userImpliedRate.toFixed(4),
                from: fromCur,
                to: toCur,
              })}
              {previewRate !== null &&
                Math.abs(userImpliedRate - previewRate) / previewRate > 0.005 && (
                  <span className="text-(--muted)/70">
                    {" "}
                    ({t("transfers.marketRate", { rate: previewRate.toFixed(4) })})
                  </span>
                )}
            </p>
          ) : previewRate !== null ? (
            <p className="text-[11px] text-(--muted)">
              {t("transfers.rateLine", {
                rate: previewRate.toFixed(4),
                from: fromCur,
                to: toCur,
              })}
              {fromAmount && parseFloat(fromAmount) > 0 && (
                <>
                  {" "}
                  ≈{" "}
                  {formatCurrency(
                    parseFloat(fromAmount) * previewRate,
                    toCur,
                    fmtLocale
                  )}
                </>
              )}
            </p>
          ) : null}
          <p className="text-[11px] text-(--muted)/80">
            {t("transfers.toAmountHint")}
          </p>
        </div>
      )}

      {/* Note */}
      <div>
        <label className="block text-xs text-(--muted) mb-1">
          {t("transfers.noteLabel")}
        </label>
        <input
          type="text"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("transfers.notePlaceholder")}
          className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-xs text-(--muted) mb-1">
          {t("transfers.dateLabel")}
        </label>
        <input
          ref={dateRef}
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/accounts")}
          disabled={pending}
          className="flex-1 px-4 py-2.5 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium disabled:opacity-50"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || !fromId || !toId || !!sameAccount}
          className="flex-[2] px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
        >
          {pending ? t("common.saving") : t("transfers.createButton")}
        </button>
      </div>
    </form>
  );
}
