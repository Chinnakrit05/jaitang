import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import {
  TransactionForm,
  type AccountChoice,
  type SplitMember,
} from "@/components/transaction-form";
import { updateTransactionAction, deleteTransactionAction } from "../../actions";
import { getServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/members";
import { listSplits } from "@/lib/splits";
import { listTrips } from "@/lib/trips";
import { listAccounts } from "@/lib/accounts";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeleteForm } from "./delete-form";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, { ledgerId, userId, ledger }, t] = await Promise.all([
    params,
    requireSession(),
    getTranslations(),
  ]);

  const sb = getServerSupabase();

  // Fetch transaction + categories + (members/splits if shared) + trips + accounts in parallel
  const [txRes, categories, members, existingSplits, allTrips, accountRows] =
    await Promise.all([
      sb
        .from("transactions")
        .select(
          "id, ledger_id, kind, amount, category_id, trip_id, account_id, note, payment_method, fx_currency, fx_amount, fx_rate, occurred_at, user_id"
        )
        .eq("id", id)
        .eq("ledger_id", ledgerId)
        .maybeSingle(),
      listCategories(ledgerId),
      ledger.is_personal ? Promise.resolve(null) : listMembers(ledgerId),
      ledger.is_personal ? Promise.resolve([]) : listSplits(id),
      listTrips(ledgerId),
      listAccounts(ledgerId, { includeArchived: true }),
    ]);

  if (txRes.error) throw txRes.error;
  const tx = txRes.data;
  if (!tx) notFound();

  const boundAction = updateTransactionAction.bind(null, id);

  const splitMembers: SplitMember[] | undefined = members
    ? members.map((m) => ({
        userId: m.user_id,
        name: m.user?.name ?? m.user?.email ?? "?",
        email: m.user?.email ?? null,
        image: m.user?.image ?? null,
        isYou: m.user_id === userId,
      }))
    : undefined;

  const splitWith =
    splitMembers && existingSplits.length > 0
      ? [tx.user_id, ...existingSplits.map((s) => s.user_id)]
      : undefined;

  const accounts: AccountChoice[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    currency: a.currency ?? ledger.currency,
    archived: a.archived,
  }));

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground) mb-4"
      >
        <ArrowLeft size={16} />
        {t("common.back")}
      </Link>
      <h1 className="text-2xl font-bold mb-6">{t("transactions.editTitle")}</h1>
      <TransactionForm
        categories={categories}
        splitMembers={splitMembers}
        trips={allTrips
          .filter((tr) => !tr.archived)
          .map((tr) => ({
            id: tr.id,
            name: tr.name,
            icon: tr.icon,
            currency: tr.currency,
          }))}
        accounts={accounts}
        currency={ledger.currency}
        initial={{
          id: tx.id,
          kind: tx.kind,
          // For FX rows we want the form to display the NATIVE amount, not
          // the home value — that's what the user originally typed and
          // expects to edit. fx_amount falls back to amount for legacy rows.
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
          fxAmount: tx.fx_amount ?? null,
          fxRate: tx.fx_rate ?? null,
          occurredAt: tx.occurred_at,
          splitWith,
        }}
        action={boundAction}
        submitLabel={t("transactions.submitUpdate")}
      />
      <div className="mt-8 pt-6 border-t border-(--border)">
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
