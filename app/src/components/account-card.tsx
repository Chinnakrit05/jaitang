"use client";

import Link from "next/link";
import { JtIcon, EmojiOrIcon, type IconName } from "@/components/icons";
import { useTranslations } from "next-intl";

import { cn, formatCurrency } from "@/lib/utils";
import type { AccountWithBalance } from "@/lib/accounts";

const TYPE_ICONS: Record<AccountWithBalance["type"], IconName> = {
  cash: "banknote",
  bank: "landmark",
  credit_card: "credit-card",
  e_wallet: "smartphone",
};

/**
 * Card on the /accounts list. Click → account detail. Shows current
 * balance + tx/transfer counts. Negative balances (overdrawn or
 * credit-card debt) get the expense-color treatment for legibility.
 */
export function AccountCard({
  account,
  ledgerCurrency,
  fmtLocale,
}: {
  account: AccountWithBalance;
  ledgerCurrency: string;
  fmtLocale: string;
}) {
  const t = useTranslations();
  const typeIcon = TYPE_ICONS[account.type];
  const accountCurrency = account.currency ?? ledgerCurrency;
  const balanceColor =
    account.balance < 0
      ? "text-(--expense)"
      : account.balance > 0
      ? "text-(--foreground)"
      : "text-(--muted)";

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 card-hover",
        account.archived
          ? "border-(--border) bg-(--card)/60 opacity-75"
          : "border-(--border) bg-(--card) hover:border-(--muted)/40"
      )}
    >
      <Link href={`/accounts/${account.id}`} className="block space-y-3">
        <div className="flex items-start gap-3">
          <span
            className="text-2xl shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor: account.color
                ? `${account.color}20`
                : "var(--background)",
              color: account.color ?? "var(--foreground)",
            }}
          >
            {account.icon ? (
              <EmojiOrIcon value={account.icon} size={20} />
            ) : (
              <JtIcon name={typeIcon} size={20} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{account.name}</h3>
              {accountCurrency !== ledgerCurrency && (
                <span className="inline-flex items-center text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5 tabular-nums">
                  {accountCurrency}
                </span>
              )}
              {account.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5">
                  <JtIcon name="archive" size={12} />
                  {t("accounts.archivedBadge")}
                </span>
              )}
            </div>
            <div className="text-xs text-(--muted) mt-0.5">
              {t(`accounts.type.${account.type}`)}
            </div>
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
            {t("accounts.balanceLabel")}
          </span>
          <span className={`text-lg font-bold tabular-nums ${balanceColor}`}>
            {formatCurrency(account.balance, accountCurrency, fmtLocale)}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-(--muted)">
          <span>{t("accounts.txCount", { count: account.txCount })}</span>
          <span>
            {t("accounts.transferCount", { count: account.transferCount })}
          </span>
        </div>
      </Link>
    </li>
  );
}
