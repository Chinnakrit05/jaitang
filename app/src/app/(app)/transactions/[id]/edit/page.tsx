import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { NewTransactionForm } from "@/components/new-transaction-form";
import type {
  AccountChoice,
  TripChoice,
} from "@/components/transaction-form";
import {
  updateTransactionAction,
  deleteTransactionAction,
} from "../../actions";
import { getServerSupabase } from "@/lib/supabase/server";
import { listTrips } from "@/lib/trips";
import { listAccounts } from "@/lib/accounts";
import { listDistinctNotes } from "@/lib/transactions";
import { notFound } from "next/navigation";

import { DeleteForm } from "./delete-form";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { ledgerId, ledger, activeTripId }] = await Promise.all([
    params,
    requireSession(),
  ]);

  const sb = getServerSupabase();

  // Edit screen now reuses the same NewTransactionForm shell as the
  // create flow. The long-form (split / trip-change / date-time)
  // surface has been removed for parity with the mobile mockup —
  // amount / note / payment / category / account are the fields
  // we expect users to tweak day-to-day; trip + occurredAt are
  // preserved silently from the row's existing state.
  const [txRes, categories, allTrips, accountRows, noteSuggestions] =
    await Promise.all([
      sb
        .from("transactions")
        .select(
          "id, kind, amount, category_id, trip_id, account_id, note, payment_method, fx_currency, fx_amount, occurred_at"
        )
        .eq("id", id)
        .eq("ledger_id", ledgerId)
        .maybeSingle(),
      listCategories(ledgerId),
      listTrips(ledgerId),
      listAccounts(ledgerId, { includeArchived: true }),
      listDistinctNotes(ledgerId, 200),
    ]);

  if (txRes.error) throw txRes.error;
  const tx = txRes.data;
  if (!tx) notFound();

  const boundAction = updateTransactionAction.bind(null, id);

  const accounts: AccountChoice[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    currency: a.currency ?? ledger.currency,
    archived: a.archived,
  }));

  // Active-trip pinning mirrors the create flow: if the row already
  // belongs to a trip, surface that as `activeTrip`; otherwise fall
  // back to the session's active trip (if any).
  const tripId = tx.trip_id ?? activeTripId ?? null;
  const tripRow = tripId
    ? allTrips.find((tr) => tr.id === tripId)
    : null;
  const activeTrip: TripChoice | null = tripRow
    ? {
        id: tripRow.id,
        name: tripRow.name,
        icon: tripRow.icon,
        currency: tripRow.currency,
      }
    : null;

  return (
    <div className="max-w-md mx-auto pb-28">
      <NewTransactionForm
        categories={categories}
        accounts={accounts}
        activeTrip={activeTrip}
        noteSuggestions={noteSuggestions}
        currency={ledger.currency}
        action={boundAction}
        initial={{
          kind: tx.kind,
          // Foreign-currency rows store fx_amount as the typed value;
          // amount is the home-currency conversion. Show the native
          // figure so the user edits what they originally typed.
          amount:
            tx.fx_amount !== null && tx.fx_amount !== undefined
              ? Number(tx.fx_amount)
              : Number(tx.amount),
          categoryId: tx.category_id,
          note: tx.note,
          paymentMethod: tx.payment_method ?? null,
          tripId: tx.trip_id ?? null,
          accountId: tx.account_id ?? null,
          fxCurrency: tx.fx_currency ?? null,
          occurredAt: tx.occurred_at,
        }}
      />
      <div className="mt-6 px-4">
        <DeleteForm
          id={id}
          deleteAction={async () => {
            "use server";
            await deleteTransactionAction(id);
          }}
        />
      </div>
    </div>
  );
}
