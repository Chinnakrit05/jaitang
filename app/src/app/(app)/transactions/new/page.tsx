import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { NewTransactionPage } from "@/components/new-transaction-page";
import { createTransactionAction } from "../actions";
import { listMembers } from "@/lib/members";
import { getTrip, listTrips } from "@/lib/trips";
import type { SplitMember, TripChoice } from "@/components/transaction-form";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewTransaction() {
  const ocrEnabled = !!process.env.ANTHROPIC_API_KEY;

  const [{ ledgerId, ledger, userId, activeTripId }, t] = await Promise.all([
    requireSession(),
    getTranslations(),
  ]);

  // Fetch categories + members + trip data in parallel
  const [categories, members, activeTripRow, allTripStats] = await Promise.all([
    listCategories(ledgerId),
    ledger.is_personal ? Promise.resolve(null) : listMembers(ledgerId),
    activeTripId ? getTrip(activeTripId, ledgerId) : Promise.resolve(null),
    listTrips(ledgerId),
  ]);

  const splitMembers: SplitMember[] | undefined = members
    ? members.map((m) => ({
        userId: m.user_id,
        name: m.user?.name ?? m.user?.email ?? "?",
        email: m.user?.email ?? null,
        image: m.user?.image ?? null,
        isYou: m.user_id === userId,
      }))
    : undefined;

  const activeTrip: TripChoice | null =
    activeTripRow && !activeTripRow.archived
      ? {
          id: activeTripRow.id,
          name: activeTripRow.name,
          icon: activeTripRow.icon,
        }
      : null;

  // Trip picker shouldn't show archived trips for new selection.
  const trips: TripChoice[] = allTripStats
    .filter((tr) => !tr.archived)
    .map((tr) => ({ id: tr.id, name: tr.name, icon: tr.icon }));

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground) mb-4"
      >
        <ArrowLeft size={16} />
        {t("common.back")}
      </Link>
      <h1 className="text-2xl font-bold mb-6">{t("transactions.newTitle")}</h1>
      <NewTransactionPage
        categories={categories}
        action={createTransactionAction}
        ocrEnabled={ocrEnabled}
        splitMembers={splitMembers}
        activeTrip={activeTrip}
        trips={trips}
      />
    </div>
  );
}
