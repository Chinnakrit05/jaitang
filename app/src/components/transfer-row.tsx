"use client";

import { useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type { TransferWithAccounts } from "@/lib/transfers";
import { formatCurrency, formatDate } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { deleteTransferAction } from "@/app/(app)/accounts/actions";

/**
 * One row in the unified timeline on /accounts/[id]. Shows from→to,
 * the account-relative direction (out=expense red, in=income green),
 * and a small delete button for owners. Cross-currency rows surface
 * both sides plus the implicit FX rate.
 *
 * The "viewing from" account is passed as `accountId` so we can pick
 * the right sign and amount to highlight — same transfer reads
 * differently from each side.
 */
export function TransferRow({
  transfer,
  accountId,
  canDelete,
}: {
  transfer: TransferWithAccounts;
  accountId: string;
  canDelete: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isOutgoing = transfer.from_account_id === accountId;
  const ownAmount = isOutgoing ? transfer.from_amount : transfer.to_amount;
  const ownCurrency = isOutgoing ? transfer.from_currency : transfer.to_currency;
  const otherAmount = isOutgoing ? transfer.to_amount : transfer.from_amount;
  const otherCurrency = isOutgoing
    ? transfer.to_currency
    : transfer.from_currency;
  const otherAccount = isOutgoing ? transfer.toAccount : transfer.fromAccount;
  const otherName = otherAccount?.name ?? "—";
  const otherIcon = otherAccount?.icon ?? "🔁";
  const isCrossCurrency = transfer.from_currency !== transfer.to_currency;

  const sign = isOutgoing ? "−" : "+";
  const amountColor = isOutgoing ? "text-(--expense)" : "text-(--income)";

  function onDelete() {
    if (!confirm(t("transfers.deleteConfirm"))) return;
    startTransition(async () => {
      await deleteTransferAction(transfer.id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 py-3 px-3 rounded-xl border border-(--border) bg-(--card)">
      <span
        className="text-xl shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-(--background) border border-(--border)"
        aria-hidden
      >
        {otherIcon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium truncate">
          <span className="text-(--muted)">
            {isOutgoing ? t("transfers.toLabel") : t("transfers.fromLabel")}
          </span>
          <JtIcon name="arrow-right" size={16} className="text-(--muted) shrink-0" />
          <span className="truncate">{otherName}</span>
        </div>
        {transfer.note && (
          <div className="text-xs text-(--muted) truncate mt-0.5">
            {transfer.note}
          </div>
        )}
        <div className="text-[11px] text-(--muted) mt-0.5">
          {formatDate(transfer.occurred_at, fmtLocale)}
          {isCrossCurrency && (
            <>
              {" • "}
              {formatCurrency(otherAmount, otherCurrency, fmtLocale)}
              <span className="text-(--muted)/70 ml-1">
                @{transfer.fx_rate.toFixed(4)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-semibold tabular-nums ${amountColor}`}>
          {sign}
          {formatCurrency(ownAmount, ownCurrency, fmtLocale)}
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            aria-label={t("transfers.delete")}
            title={t("transfers.delete")}
            className="mt-0.5 inline-flex items-center justify-center h-6 w-6 rounded-md text-(--muted) hover:text-(--expense) hover:bg-(--expense)/10 disabled:opacity-50"
          >
            <JtIcon name="trash2" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
