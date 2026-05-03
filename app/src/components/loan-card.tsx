"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { LoanWithStats } from "@/lib/loans";

/**
 * Card for the /loans list. Shows direction (lent/borrowed),
 * counterparty, remaining vs principal, and overdue/settled status.
 */
export function LoanCard({
  loan,
  fmtLocale,
}: {
  loan: LoanWithStats;
  fmtLocale: string;
}) {
  const t = useTranslations();
  const isLent = loan.kind === "lent";
  const settled = loan.status === "settled" || loan.remaining === 0;
  const progress =
    loan.principal > 0
      ? Math.min(1, loan.repaidAmount / loan.principal)
      : 0;

  const directionColor = isLent ? "text-(--income)" : "text-(--expense)";
  const directionBg = isLent ? "bg-(--income)" : "bg-(--expense)";

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 card-hover",
        settled
          ? "border-(--border) bg-(--card)/60 opacity-75"
          : loan.overdue
          ? "border-(--expense)/40 bg-(--expense)/5"
          : "border-(--border) bg-(--card) hover:border-(--muted)/40"
      )}
    >
      <Link href={`/loans/${loan.id}`} className="block space-y-3">
        <div className="flex items-start gap-3">
          <span
            className={`shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-(--background) ${directionColor}`}
          >
            {isLent ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{loan.counterparty}</h3>
              {settled ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--income) bg-(--income)/10 rounded-full px-2 py-0.5">
                  <CheckCircle2 size={12} />
                  {t("loans.settledBadge")}
                </span>
              ) : loan.overdue ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--expense) bg-(--expense)/10 rounded-full px-2 py-0.5">
                  <AlertTriangle size={12} />
                  {t("loans.overdueBadge")}
                </span>
              ) : null}
              {loan.currency !== "THB" && (
                <span className="inline-flex items-center text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5 tabular-nums">
                  {loan.currency}
                </span>
              )}
            </div>
            <div className="text-xs text-(--muted) mt-0.5">
              {isLent ? t("loans.directionLent") : t("loans.directionBorrowed")}
              {loan.due_date && (
                <>
                  <span className="mx-1">•</span>
                  {t("loans.dueLine", {
                    when: formatDate(loan.due_date, fmtLocale),
                  })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {!settled && (
          <div>
            <div className="h-1.5 bg-(--background) rounded-full overflow-hidden">
              <div
                className={`h-full ${directionBg} transition-all`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs">
              <span className="text-(--muted)">
                {t("loans.repaidLine", {
                  paid: formatCurrency(
                    loan.repaidAmount,
                    loan.currency,
                    fmtLocale
                  ),
                  total: formatCurrency(
                    loan.principal,
                    loan.currency,
                    fmtLocale
                  ),
                })}
              </span>
              <span className={`tabular-nums font-semibold ${directionColor}`}>
                {formatCurrency(loan.remaining, loan.currency, fmtLocale)}
              </span>
            </div>
          </div>
        )}

        {settled && (
          <div className="text-sm text-(--muted) tabular-nums">
            {formatCurrency(loan.principal, loan.currency, fmtLocale)}
          </div>
        )}
      </Link>
    </li>
  );
}
