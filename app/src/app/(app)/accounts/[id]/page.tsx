import Link from "next/link";
import { notFound } from "next/navigation";

import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { getAccount } from "@/lib/accounts";
import { listTransactions } from "@/lib/transactions";
import { listTransfersForAccount } from "@/lib/transfers";
import { buildNetWorthHistory } from "@/lib/net-worth";
import { TransactionList } from "@/components/transaction-list";
import { TransferRow } from "@/components/transfer-row";
import { AccountActions } from "@/components/account-actions";
import { AccountBalanceChart } from "@/components/account-balance-chart";
import { EditAccountModal } from "@/components/edit-account-modal";
import { ReconcileModal } from "@/components/reconcile-modal";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import {
  archiveAccountAction,
  deleteAccountAction,
  unarchiveAccountAction,
} from "@/app/(app)/accounts/actions";
import type { AccountType } from "@/lib/types";

import { JtIcon, EmojiOrIcon, type IconName } from "@/components/icons";

const TYPE_ICONS: Record<AccountType, IconName> = {
  cash: "banknote",
  bank: "landmark",
  credit_card: "credit-card",
  e_wallet: "smartphone",
};

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { ledgerId, ledger, role }, t, locale] = await Promise.all([
    params,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);
  const canManage = role !== "viewer";

  const account = await getAccount(id, ledgerId);
  if (!account) notFound();

  const accountCurrency = account.currency ?? ledger.currency;

  // Pull transactions tagged with this account, plus transfers touching
  // it on either side. Both feed the timeline. Also pull net-worth
  // history so we can render this account's per-month balance series.
  const [transactions, transfers, netWorthHistory] = await Promise.all([
    listTransactions({ ledgerId, accountId: account.id, limit: 5000 }),
    listTransfersForAccount(account.id, ledgerId, 500),
    buildNetWorthHistory(ledgerId, ledger.currency, { monthsBack: 11 }),
  ]);

  // Extract this account's series from the net-worth history.
  const chartPoints = netWorthHistory.map((snap) => ({
    date: snap.date,
    value: snap.perAccount[account.id] ?? 0,
  }));

  // Bind action ids before passing to the client.
  const archiveBound = archiveAccountAction.bind(null, account.id);
  const unarchiveBound = unarchiveAccountAction.bind(null, account.id);
  const deleteBound = deleteAccountAction.bind(null, account.id);

  const typeIcon = TYPE_ICONS[account.type as AccountType];
  const balanceColor =
    account.balance < 0
      ? "text-(--expense)"
      : account.balance > 0
      ? "text-(--foreground)"
      : "text-(--muted)";

  // Breakdown for the stat row: tx delta + transfer in/out (in account
  // currency). We re-derive the same numbers used in the balance formula
  // so the row can be cross-checked against the headline number.
  let txIncomeNative = 0;
  let txExpenseNative = 0;
  for (const tx of transactions) {
    const native =
      tx.fx_currency === accountCurrency && tx.fx_amount !== null
        ? Number(tx.fx_amount)
        : !tx.fx_currency
        ? Number(tx.amount)
        : null;
    if (native === null) continue; // currency mismatch skipped, like the lib
    if (tx.kind === "income") txIncomeNative += native;
    else txExpenseNative += native;
  }
  let transferInNative = 0;
  let transferOutNative = 0;
  for (const tr of transfers) {
    if (tr.to_account_id === account.id) transferInNative += tr.to_amount;
    if (tr.from_account_id === account.id) transferOutNative += tr.from_amount;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
      >
        <JtIcon name="arrow-left" size={20} />
        {t("accounts.backToList")}
      </Link>

      {/* Header. Edit button absolutely positioned in top-right, same
          pattern as trip detail. */}
      <div className="rounded-[22px] soft-raised p-5 relative">
        {canManage && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <ReconcileModal
              accountId={account.id}
              accountCurrency={accountCurrency}
            />
            <EditAccountModal
              account={account}
              ledgerCurrency={ledger.currency}
            />
          </div>
        )}
        <div className="flex items-start gap-4">
          <span
            className="text-4xl shrink-0 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: account.color
                ? `${account.color}20`
                : "var(--background)",
              color: account.color ?? "var(--foreground)",
            }}
          >
            {account.icon ? (
              <EmojiOrIcon value={account.icon} size={32} />
            ) : (
              <JtIcon name={typeIcon} size={32} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <h1
              className={`text-2xl font-bold flex items-center gap-2 flex-wrap ${
                canManage ? "pr-24 sm:pr-56" : ""
              }`}
            >
              {account.name}
              {accountCurrency !== ledger.currency && (
                <span className="inline-flex items-center text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5 tabular-nums">
                  {accountCurrency}
                </span>
              )}
              {account.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5">
                  <JtIcon name="archive" size={16} />
                  {t("accounts.archivedBadge")}
                </span>
              )}
            </h1>
            <p className="text-sm text-(--muted) mt-1">
              {t(`accounts.type.${account.type}`)}
            </p>
          </div>
        </div>

        {/* Headline balance */}
        <div className="mt-5 rounded-xl border border-(--border) bg-(--background) px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
            {t("accounts.balanceLabel")}
          </div>
          <div className={`mt-1 text-3xl font-bold tabular-nums ${balanceColor}`}>
            {formatCurrency(account.balance, accountCurrency, fmtLocale)}
          </div>
        </div>

        {/* Breakdown stats — initial + tx delta + transfer flow. Lets
            the user audit the headline number at a glance. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Stat
            label={t("accounts.initialLabel")}
            value={account.initial_balance}
            currency={accountCurrency}
            fmtLocale={fmtLocale}
          />
          <Stat
            label={t("accounts.incomeLabel")}
            value={txIncomeNative}
            tone="income"
            currency={accountCurrency}
            fmtLocale={fmtLocale}
          />
          <Stat
            label={t("accounts.expenseLabel")}
            value={txExpenseNative}
            tone="expense"
            currency={accountCurrency}
            fmtLocale={fmtLocale}
          />
          <Stat
            label={t("accounts.netTransfersLabel")}
            value={transferInNative - transferOutNative}
            tone={
              transferInNative - transferOutNative >= 0 ? "income" : "expense"
            }
            currency={accountCurrency}
            fmtLocale={fmtLocale}
            signed
          />
        </div>

        {canManage && (
          <AccountActions
            accountId={account.id}
            archived={account.archived}
            onArchive={archiveBound}
            onUnarchive={unarchiveBound}
            onDelete={deleteBound}
            labels={{
              archive: t("accounts.archive"),
              unarchive: t("accounts.unarchive"),
              delete: t("accounts.delete"),
              archiveConfirm: t("accounts.archiveConfirm"),
              deleteConfirm: t("accounts.deleteConfirm", { name: account.name }),
              working: t("common.saving"),
            }}
          />
        )}
      </div>

      {/* Per-account balance chart */}
      <section className="rounded-[22px] soft-raised p-5">
        <h2 className="font-semibold mb-3 text-sm">
          {t("accounts.chartHeading")}
        </h2>
        <AccountBalanceChart
          points={chartPoints}
          currency={accountCurrency}
          color={account.color}
        />
      </section>

      {/* Transfers section — only render the heading if there are any */}
      {transfers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <JtIcon name="arrow-left-right" size={20} className="text-(--muted)" />
              {t("transfers.heading")}
            </h2>
            {canManage && !account.archived && (
              <Link
                href="/transfers/new"
                className="text-sm text-(--accent) hover:underline"
              >
                + {t("transfers.newButton")}
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {transfers.map((tr) => (
              <TransferRow
                key={tr.id}
                transfer={tr}
                accountId={account.id}
                canDelete={canManage}
              />
            ))}
          </div>
        </section>
      )}

      {/* Transactions section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("accounts.transactionsHeading")}</h2>
          {canManage && !account.archived && transfers.length === 0 && (
            <Link
              href="/transfers/new"
              className="text-sm text-(--accent) hover:underline"
            >
              <JtIcon name="arrow-left-right" size={18} className="inline mr-1" />
              {t("transfers.newButton")}
            </Link>
          )}
        </div>
        <TransactionList
          items={transactions}
          showAttribution={!ledger.is_personal}
          currency={ledger.currency}
        />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  currency,
  fmtLocale,
  signed = false,
}: {
  label: string;
  value: number;
  tone?: "income" | "expense";
  currency: string;
  fmtLocale: string;
  signed?: boolean;
}) {
  const cls =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--foreground)";
  const prefix = signed
    ? value > 0
      ? "+"
      : value < 0
      ? "−"
      : ""
    : tone === "expense"
    ? "−"
    : tone === "income"
    ? "+"
    : "";
  const display = signed ? Math.abs(value) : value;
  return (
    <div className="rounded-xl border border-(--border) bg-(--background) px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
        {label}
      </div>
      <div className={`mt-0.5 font-semibold text-sm tabular-nums ${cls}`}>
        {prefix}
        {formatCurrency(display, currency, fmtLocale)}
      </div>
    </div>
  );
}
