import { requireSession } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard-shell";
import { getTrip } from "@/lib/trips";
import { listTransactions } from "@/lib/transactions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, ledger, ledgerId, activeTripId } = await requireSession();

  // If the user has an active trip, fetch its display data + tx count for
  // the banner. We accept the extra round-trip on every navigation as the
  // cost of giving the user constant "you are still in trip mode" feedback.
  let activeTripBanner: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    txCount: number;
  } | null = null;
  if (activeTripId) {
    const [trip, txs] = await Promise.all([
      getTrip(activeTripId, ledgerId),
      listTransactions({ ledgerId, tripId: activeTripId, limit: 5000 }),
    ]);
    if (trip && !trip.archived) {
      activeTripBanner = {
        id: trip.id,
        name: trip.name,
        icon: trip.icon,
        color: trip.color,
        txCount: txs.length,
      };
    }
  }

  return (
    <DashboardShell
      userName={user.name}
      userImage={user.image}
      activeLedger={{
        id: ledger.id,
        name: ledger.name,
        icon: ledger.icon,
        isPersonal: ledger.is_personal,
        role,
      }}
      ledgerCurrency={ledger.currency}
      activeTripBanner={activeTripBanner}
    >
      {children}
    </DashboardShell>
  );
}
