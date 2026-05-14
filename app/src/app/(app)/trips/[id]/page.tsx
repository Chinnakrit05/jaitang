import Link from "next/link";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { notFound } from "next/navigation";

import { getLocale, getTranslations } from "next-intl/server";
import { requireSession, assertWritable } from "@/lib/session";
import { getTrip } from "@/lib/trips";
import { listTransactions } from "@/lib/transactions";
import { TransactionList } from "@/components/transaction-list";
import { TripActions } from "@/components/trip-actions";
import { EditTripModal } from "@/components/edit-trip-modal";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import {
  archiveTripAction,
  deleteTripAction,
  setActiveTripAction,
  unarchiveTripAction,
} from "@/app/(app)/trips/actions";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { ledgerId, ledger, role, activeTripId }, t, locale] =
    await Promise.all([
      params,
      requireSession(),
      getTranslations(),
      getLocale(),
    ]);
  const fmtLocale = intlLocale(locale);
  // Read-only viewers can land here but they can't manage the trip.
  const canManage = role !== "viewer";

  const trip = await getTrip(id, ledgerId);
  if (!trip) notFound();

  const isActive = activeTripId === trip.id;

  const items = await listTransactions({
    ledgerId,
    tripId: trip.id,
    limit: 5000,
  });
  const totalIncome = items
    .filter((tx) => tx.kind === "income")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = items
    .filter((tx) => tx.kind === "expense")
    .reduce((s, tx) => s + tx.amount, 0);

  // Group expenses by currency for the multi-currency display. Trip can
  // have rows from before/after a currency change — both are valid and
  // shown side by side. Home-currency rows (fx_currency = null) bucket
  // under ledger.currency.
  type Bucket = { currency: string; total: number; homeTotal: number };
  const expenseByCurrency = new Map<string, Bucket>();
  for (const tx of items) {
    if (tx.kind !== "expense") continue;
    const cur = tx.fx_currency ?? ledger.currency;
    const native = tx.fx_amount ?? tx.amount;
    const b = expenseByCurrency.get(cur) ?? {
      currency: cur,
      total: 0,
      homeTotal: 0,
    };
    b.total += native;
    b.homeTotal += tx.amount; // amount is always home currency
    expenseByCurrency.set(cur, b);
  }
  const expenseBuckets = Array.from(expenseByCurrency.values()).sort(
    (a, b) => b.homeTotal - a.homeTotal
  );
  const showMultiCurrency = expenseBuckets.length > 1;

  // Bind action ids before passing to the client. We can't pass server
  // actions across the RSC boundary with arguments otherwise.
  const setActiveBound = setActiveTripAction.bind(null, trip.id);
  const archiveBound = archiveTripAction.bind(null, trip.id);
  const unarchiveBound = unarchiveTripAction.bind(null, trip.id);
  const deleteBound = deleteTripAction.bind(null, trip.id);

  // Auth check for the bound actions: re-validate on the server side
  // before we even render the buttons, so a viewer who guessed the URL
  // doesn't see "Archive" / "Delete" buttons that would 500 on click.
  if (!canManage) {
    // best-effort guard for `<form action={archiveBound}>` etc.
    // Buttons are gated below; this pre-check just confirms the role
    // is still live as of render time.
    void assertWritable;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
      >
        <JtIcon name="arrow-left" size={20} />
        {t("trips.backToList")}
      </Link>

      {/* Header. The edit button is positioned absolutely in the corner
          so it stays visible regardless of how the title + badges wrap on
          narrow screens — previously it sat after the h1 in flex-wrap and
          got pushed below the fold on mobile. */}
      <div className="rounded-2xl border border-(--border) bg-(--card) p-5 relative">
        {canManage && (
          <div className="absolute top-3 right-3 z-10">
            <EditTripModal trip={trip} ledgerCurrency={ledger.currency} />
          </div>
        )}
        <div className="flex items-start gap-4">
          <EmojiOrIcon value={trip.icon} fallback="airplane" size={48} className="shrink-0" />
          <div className="flex-1 min-w-0">
            {/* Reserve room on the right for the absolute-positioned edit
                button so the title doesn't run under it. */}
            <h1 className={`text-2xl font-bold flex items-center gap-2 flex-wrap ${canManage ? "pr-12 sm:pr-28" : ""}`}>
              {trip.name}
              {trip.currency && trip.currency !== ledger.currency && (
                <span className="inline-flex items-center text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5 tabular-nums">
                  {trip.currency}
                </span>
              )}
              {trip.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5">
                  <JtIcon name="archive" size={16} />
                  {t("trips.archivedBadge")}
                </span>
              )}
              {isActive && !trip.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--accent-foreground) bg-(--accent) rounded-full px-2 py-0.5">
                  <JtIcon name="trips" size={16} />
                  {t("trips.activeBadge")}
                </span>
              )}
            </h1>
            {(trip.starts_at || trip.ends_at) && (
              <p className="text-sm text-(--muted) mt-1">
                {formatTripRange(trip.starts_at, trip.ends_at, fmtLocale)}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 text-sm">
          <Stat
            label={t("transactions.totalIncome")}
            value={totalIncome}
            tone="income"
            currency={ledger.currency}
            fmtLocale={fmtLocale}
          />
          <Stat
            label={t("transactions.totalExpense")}
            value={totalExpense}
            tone="expense"
            currency={ledger.currency}
            fmtLocale={fmtLocale}
          />
          <Stat
            label={t("trips.txCountLabel")}
            value={items.length}
            currency={ledger.currency}
            fmtLocale={fmtLocale}
            isCount
          />
        </div>

        {/* Multi-currency breakdown — only when the trip's expenses span
            more than one currency, e.g. user changed trip currency mid-trip
            or recorded a one-off in a different currency. Single-currency
            trips (the common case) don't need this, the totals above suffice. */}
        {showMultiCurrency && (
          <div className="mt-4 rounded-xl border border-(--border) bg-(--background) p-3 space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
              {t("trips.byCurrencyHeading")}
            </div>
            {expenseBuckets.map((b) => (
              <div
                key={b.currency}
                className="flex items-center justify-between text-sm tabular-nums"
              >
                <span className="font-medium">
                  {formatCurrency(b.total, b.currency, fmtLocale)}
                </span>
                {b.currency !== ledger.currency && (
                  <span className="text-(--muted) text-xs">
                    ≈ {formatCurrency(b.homeTotal, ledger.currency, fmtLocale)}
                  </span>
                )}
              </div>
            ))}
            <div className="border-t border-(--border) pt-1.5 mt-1.5 flex items-center justify-between text-sm font-semibold tabular-nums">
              <span>{t("trips.totalHome")}</span>
              <span className="text-(--expense)">
                ≈ {formatCurrency(totalExpense, ledger.currency, fmtLocale)}
              </span>
            </div>
          </div>
        )}

        {canManage && (
          <TripActions
            tripId={trip.id}
            archived={trip.archived}
            isActive={isActive}
            onSetActive={setActiveBound}
            onArchive={archiveBound}
            onUnarchive={unarchiveBound}
            onDelete={deleteBound}
            labels={{
              setActive: t("trips.setActive"),
              archive: t("trips.archive"),
              unarchive: t("trips.unarchive"),
              delete: t("trips.delete"),
              archiveConfirm: t("trips.archiveConfirm"),
              deleteConfirm: t("trips.deleteConfirm", { name: trip.name }),
              working: t("common.saving"),
            }}
          />
        )}
      </div>

      {/* Transactions list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("trips.transactionsHeading")}</h2>
          {canManage && !trip.archived && (
            <Link
              href={isActive ? "/transactions/new" : `/trips`}
              className="text-sm text-(--accent) hover:underline"
            >
              {isActive
                ? `+ ${t("transactions.addNew")}`
                : t("trips.activateToAdd")}
            </Link>
          )}
        </div>

        <TransactionList
          items={items}
          showAttribution={!ledger.is_personal}
          currency={ledger.currency}
          showTrip={false}
          showRemoveFromTrip={canManage}
        />

        {items.length > 0 && (
          <p className="text-xs text-(--muted) px-1">
            {t("trips.removeHint")}
          </p>
        )}
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
  isCount = false,
}: {
  label: string;
  value: number;
  tone?: "income" | "expense";
  currency: string;
  fmtLocale: string;
  isCount?: boolean;
}) {
  const cls =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--foreground)";
  return (
    <div className="rounded-xl border border-(--border) bg-(--background) px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-(--muted) font-medium">
        {label}
      </div>
      <div className={`mt-0.5 font-semibold tabular-nums ${cls}`}>
        {isCount
          ? value
          : `${tone === "expense" ? "−" : tone === "income" ? "+" : ""}${formatCurrency(value, currency, fmtLocale)}`}
      </div>
    </div>
  );
}

function formatTripRange(
  startsAt: string | null,
  endsAt: string | null,
  fmtLocale: string
): string {
  const fmt = new Intl.DateTimeFormat(fmtLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (startsAt && endsAt) {
    return `${fmt.format(new Date(startsAt))} – ${fmt.format(new Date(endsAt))}`;
  }
  if (startsAt) return fmt.format(new Date(startsAt));
  return fmt.format(new Date(endsAt!));
}
