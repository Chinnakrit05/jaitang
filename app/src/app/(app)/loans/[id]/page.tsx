import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getLoan, listRepayments } from "@/lib/loans";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LoanActions } from "@/components/loan-actions";
import { RepaymentForm } from "@/components/repayment-form";
import { DeleteRepaymentButton } from "@/components/delete-repayment-button";
import {
  deleteLoanAction,
  reopenLoanAction,
  settleLoanAction,
} from "@/app/(app)/loans/actions";

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { ledgerId, role }, t, locale] = await Promise.all([
    params,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);
  const canManage = role !== "viewer";

  const loan = await getLoan(id, ledgerId);
  if (!loan) notFound();

  const repayments = await listRepayments(id);

  const settled = loan.status === "settled" || loan.remaining === 0;
  const isLent = loan.kind === "lent";
  const directionColor = isLent ? "text-(--income)" : "text-(--expense)";
  const directionBg = isLent ? "bg-(--income)" : "bg-(--expense)";
  const progress =
    loan.principal > 0
      ? Math.min(1, loan.repaidAmount / loan.principal)
      : 0;

  // Bind action ids before passing to client.
  const settleBound = settleLoanAction.bind(null, loan.id);
  const reopenBound = reopenLoanAction.bind(null, loan.id);
  const deleteBound = deleteLoanAction.bind(null, loan.id);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/loans"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
      >
        <ArrowLeft size={16} />
        {t("loans.backToList")}
      </Link>

      <div className="rounded-2xl border border-(--border) bg-(--card) p-5">
        <div className="flex items-start gap-4">
          <span
            className={`shrink-0 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-(--background) ${directionColor}`}
          >
            {isLent ? <ArrowUpRight size={28} /> : <ArrowDownLeft size={28} />}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
              {loan.counterparty}
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
              <span className="inline-flex items-center text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5 tabular-nums">
                {loan.currency}
              </span>
            </h1>
            <p className="text-sm text-(--muted) mt-1">
              {isLent ? t("loans.directionLent") : t("loans.directionBorrowed")}
              {" • "}
              {t("loans.startedLine", {
                when: formatDate(loan.started_at, fmtLocale),
              })}
              {loan.due_date && (
                <>
                  {" • "}
                  {t("loans.dueLine", {
                    when: formatDate(loan.due_date, fmtLocale),
                  })}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Headline progress */}
        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-(--muted)">{t("loans.remainingLabel")}</span>
            <span
              className={`text-2xl font-bold tabular-nums ${
                settled ? "text-(--muted)" : directionColor
              }`}
            >
              {formatCurrency(loan.remaining, loan.currency, fmtLocale)}
            </span>
          </div>
          <div className="h-2 bg-(--background) rounded-full overflow-hidden">
            <div
              className={`h-full ${directionBg} transition-all`}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-(--muted) tabular-nums">
            <span>
              {t("loans.repaidLabel")}{" "}
              {formatCurrency(loan.repaidAmount, loan.currency, fmtLocale)}
            </span>
            <span>
              {t("loans.principalLine", {
                amount: formatCurrency(
                  loan.principal,
                  loan.currency,
                  fmtLocale
                ),
              })}
            </span>
          </div>
        </div>

        {loan.note && (
          <p className="mt-4 text-sm text-(--muted) italic">{loan.note}</p>
        )}

        {canManage && (
          <LoanActions
            loanId={loan.id}
            status={loan.status}
            onSettle={settleBound}
            onReopen={reopenBound}
            onDelete={deleteBound}
            labels={{
              settle: t("loans.settle"),
              reopen: t("loans.reopen"),
              delete: t("loans.delete"),
              settleConfirm: t("loans.settleConfirm"),
              deleteConfirm: t("loans.deleteConfirm", {
                name: loan.counterparty,
              }),
              working: t("common.saving"),
            }}
          />
        )}
      </div>

      {/* Repayment form */}
      {canManage && !settled && (
        <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
          <h2 className="font-semibold">{t("loans.repaymentTitle")}</h2>
          <p className="text-sm text-(--muted)">{t("loans.repaymentHint")}</p>
          <RepaymentForm
            loanId={loan.id}
            currency={loan.currency}
            remaining={loan.remaining}
          />
        </section>
      )}

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-semibold">{t("loans.historyHeading")}</h2>
        {repayments.length === 0 ? (
          <p className="text-sm text-(--muted) px-1">
            {t("loans.historyEmpty")}
          </p>
        ) : (
          <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
            {repayments.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm tabular-nums font-medium">
                    {formatCurrency(r.amount, loan.currency, fmtLocale)}
                  </div>
                  <div className="text-xs text-(--muted)">
                    {formatDate(r.occurred_at, fmtLocale)}
                    {r.note && (
                      <>
                        {" • "}
                        {r.note}
                      </>
                    )}
                  </div>
                </div>
                {canManage && (
                  <DeleteRepaymentButton
                    repaymentId={r.id}
                    confirmLabel={t("loans.repaymentDeleteConfirm")}
                    aria={t("common.delete")}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
