import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { NewTransactionPage } from "@/components/new-transaction-page";
import { createTransactionAction } from "../actions";
import { getTrip } from "@/lib/trips";
import { listAccounts } from "@/lib/accounts";
import { listDistinctNotes } from "@/lib/transactions";
import type {
  AccountChoice,
  TripChoice,
} from "@/components/transaction-form";

export default async function NewTransaction() {
  const ocrEnabled = !!process.env.ANTHROPIC_API_KEY;

  const { ledgerId, ledger, activeTripId } = await requireSession();

  const [categories, activeTripRow, accountRows, noteSuggestions] =
    await Promise.all([
      listCategories(ledgerId),
      activeTripId ? getTrip(activeTripId, ledgerId) : Promise.resolve(null),
      listAccounts(ledgerId, { includeArchived: true }),
      listDistinctNotes(ledgerId, 200),
    ]);

  const activeTrip: TripChoice | null =
    activeTripRow && !activeTripRow.archived
      ? {
          id: activeTripRow.id,
          name: activeTripRow.name,
          icon: activeTripRow.icon,
          currency: activeTripRow.currency,
        }
      : null;

  const accounts: AccountChoice[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    currency: a.currency ?? ledger.currency,
    archived: a.archived,
  }));

  return (
    <div className="max-w-md mx-auto pb-24">
      <NewTransactionPage
        categories={categories}
        action={createTransactionAction}
        ocrEnabled={ocrEnabled}
        activeTrip={activeTrip}
        accounts={accounts}
        noteSuggestions={noteSuggestions}
        currency={ledger.currency}
      />
    </div>
  );
}
