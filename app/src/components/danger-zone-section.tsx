"use client";

import { useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  wipeActiveLedgerTransactionsAction,
  wipeAllMyDataAction,
} from "@/app/(app)/settings/actions";

type Props = {
  ledgerName: string;
  isOwnerOfActiveLedger: boolean;
};

/**
 * Two destructive actions, each behind a "type the magic string" gate so a
 * stray click can't ruin someone's month.
 *
 * - Wipe active ledger transactions: keeps the ledger shell + its categories,
 *   budgets, recurring rules, and members. Just nukes income/expense rows.
 * - Wipe all owned data: deletes every owned ledger (cascading everything)
 *   plus push subscriptions, then signs out. The action redirects, so this
 *   component never sees a successful response — it stays in "working" state
 *   until the navigation lands on `/`.
 */
export function DangerZoneSection({ ledgerName, isOwnerOfActiveLedger }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{ count: number; ledgerName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ledgerConfirm, setLedgerConfirm] = useState("");
  const [allConfirm, setAllConfirm] = useState("");

  function wipeLedger() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await wipeActiveLedgerTransactionsAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({ count: result.count, ledgerName: result.ledgerName });
      setLedgerConfirm("");
      router.refresh();
    });
  }

  function wipeAll() {
    setError(null);
    startTransition(async () => {
      try {
        await wipeAllMyDataAction();
      } catch (e) {
        // Server action ends in `redirect()`, which surfaces as a thrown
        // NEXT_REDIRECT — that's expected, not an error to display.
        if (
          e instanceof Error &&
          (e.message === "NEXT_REDIRECT" || /redirect/i.test(e.message))
        ) {
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const ledgerConfirmOk =
    isOwnerOfActiveLedger &&
    ledgerConfirm.trim().length > 0 &&
    ledgerConfirm.trim() === ledgerName.trim();
  const allConfirmOk = allConfirm.trim() === "DELETE";

  return (
    <div className="space-y-5">
      {/* Wipe active ledger */}
      <div className="space-y-2">
        <div className="font-medium text-(--expense)">
          {t("settings.wipeLedgerTitle")}
        </div>
        <p className="text-sm text-(--muted)">
          {t("settings.wipeLedgerHint", { ledger: ledgerName })}
        </p>

        {!isOwnerOfActiveLedger ? (
          <div className="text-xs text-(--muted) italic">
            {t("settings.wipeLedgerOwnerOnly")}
          </div>
        ) : (
          <>
            <input
              type="text"
              value={ledgerConfirm}
              onChange={(e) => setLedgerConfirm(e.target.value)}
              placeholder={t("settings.wipeLedgerConfirmType", {
                ledger: ledgerName,
              })}
              className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--expense)/40"
              disabled={pending}
            />
            <button
              type="button"
              disabled={!ledgerConfirmOk || pending}
              onClick={wipeLedger}
              className="inline-flex items-center gap-2 rounded-xl border border-(--expense)/40 bg-(--expense)/10 text-(--expense) hover:bg-(--expense)/20 px-4 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? (
                <>
                  <JtIcon name="loader-2" size={20} className="animate-spin" />
                  {t("settings.wipeWorking")}
                </>
              ) : (
                <>
                  <JtIcon name="eraser" size={20} />
                  {t("settings.wipeLedgerButton")}
                </>
              )}
            </button>
          </>
        )}

        {done && (
          <div className="rounded-xl border border-(--income)/40 bg-(--income)/5 p-3 flex items-start gap-3 text-sm">
            <JtIcon name="check-circle-2" size={22} className="text-(--income) shrink-0 mt-0.5" />
            <span>
              {t("settings.wipeLedgerDone", {
                count: done.count,
                ledger: done.ledgerName,
              })}
            </span>
          </div>
        )}
      </div>

      {/* Wipe all owned data */}
      <div className="space-y-2 pt-5 border-t border-(--border)">
        <div className="font-medium text-(--expense)">
          {t("settings.wipeAllTitle")}
        </div>
        <p className="text-sm text-(--muted)">{t("settings.wipeAllHint")}</p>
        <input
          type="text"
          value={allConfirm}
          onChange={(e) => setAllConfirm(e.target.value)}
          placeholder={t("settings.wipeAllConfirmType")}
          className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--expense)/40"
          disabled={pending}
        />
        <button
          type="button"
          disabled={!allConfirmOk || pending}
          onClick={wipeAll}
          className="inline-flex items-center gap-2 rounded-xl bg-(--expense) text-white hover:opacity-90 px-4 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? (
            <>
              <JtIcon name="loader-2" size={20} className="animate-spin" />
              {t("settings.wipeWorking")}
            </>
          ) : (
            <>
              <JtIcon name="trash2" size={20} />
              {t("settings.wipeAllButton")}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-(--expense)/40 bg-(--expense)/5 p-3 flex items-start gap-3 text-sm text-(--expense)">
          <JtIcon name="alert-triangle" size={22} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
