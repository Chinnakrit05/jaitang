import Link from "next/link";
import { JtIcon } from "@/components/icons";

import { getLocale, getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/session";
import { listTrips } from "@/lib/trips";
import { intlLocale } from "@/lib/locale-format";
import { formatCurrency } from "@/lib/utils";
import { TripCard } from "@/components/trip-card";
import { CreateTripForm } from "@/components/create-trip-form";
import { EmptyIllustration } from "@/components/empty-illustration";

export default async function TripsPage() {
  const [{ ledgerId, ledger, activeTripId }, t, locale] = await Promise.all([
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);

  const trips = await listTrips(ledgerId, { includeArchived: true });
  const active = trips.filter((tr) => !tr.archived);
  const archived = trips.filter((tr) => tr.archived);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <JtIcon name="trips" size={22} className="text-(--accent)" />
          {t("trips.title")}
        </h1>
        <p className="text-sm text-(--muted) mt-1">{t("trips.subtitle")}</p>
      </div>

      {/* Active trips */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide">
          {t("trips.activeSection", { count: active.length })}
        </h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/40 p-8 text-center">
            <EmptyIllustration kind="trip" size={80} className="mb-3" />
            <p className="text-sm text-(--muted)">{t("trips.activeEmpty")}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map((tr) => (
              <TripCard
                key={tr.id}
                trip={tr}
                isActive={tr.id === activeTripId}
                currency={ledger.currency}
                fmtLocale={fmtLocale}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Create form */}
      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <JtIcon name="plus-fab" size={16} />
          {t("trips.createTitle")}
        </h2>
        <p className="text-sm text-(--muted)">{t("trips.createHint")}</p>
        <CreateTripForm ledgerCurrency={ledger.currency} />
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-(--muted) uppercase tracking-wide flex items-center gap-2">
            <JtIcon name="archive" size={14} />
            {t("trips.archivedSection", { count: archived.length })}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {archived.map((tr) => (
              <TripCard
                key={tr.id}
                trip={tr}
                isActive={false}
                currency={ledger.currency}
                fmtLocale={fmtLocale}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Footer hint */}
      {active.length > 0 && (
        <p className="text-xs text-(--muted)">
          {t("trips.footerHint", {
            sum: formatCurrency(
              active.reduce((s, t) => s + t.totalExpense, 0),
              ledger.currency,
              fmtLocale
            ),
          })}
        </p>
      )}

      <p className="text-xs text-(--muted)">
        <Link href="/transactions" className="hover:text-(--foreground) underline">
          ← {t("common.back")}
        </Link>
      </p>
    </div>
  );
}
