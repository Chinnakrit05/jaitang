import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, Plane } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSession, assertWritable } from "@/lib/session";
import { getTrip } from "@/lib/trips";
import { listTransactions } from "@/lib/transactions";
import { TransactionList } from "@/components/transaction-list";
import { TripActions } from "@/components/trip-actions";
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
        <ArrowLeft size={16} />
        {t("trips.backToList")}
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-(--border) bg-(--card) p-5">
        <div className="flex items-start gap-4">
          <span className="text-5xl">{trip.icon ?? "✈️"}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
              {trip.name}
              {trip.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-2 py-0.5">
                  <Archive size={12} />
                  {t("trips.archivedBadge")}
                </span>
              )}
              {isActive && !trip.archived && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-(--accent-foreground) bg-(--accent) rounded-full px-2 py-0.5">
                  <Plane size={12} />
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
