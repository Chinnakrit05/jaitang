import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { TransactionForm, type SplitMember } from "@/components/transaction-form";
import { updateTransactionAction, deleteTransactionAction } from "../../actions";
import { getServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/members";
import { listSplits } from "@/lib/splits";
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
  const { id } = await params;
  const { ledgerId, userId } = await requireSession();
  const t = await getTranslations();

  const sb = getServerSupabase();
  const { data: tx, error } = await sb
    .from("transactions")
    .select("id, ledger_id, kind, amount, category_id, note, occurred_at, user_id")
    .eq("id", id)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  if (error) throw error;
  if (!tx) notFound();

  const { data: ledger } = await sb
    .from("ledgers")
    .select("is_personal")
    .eq("id", ledgerId)
    .single();

  const categories = await listCategories(ledgerId);
  const boundAction = updateTransactionAction.bind(null, id);

  let splitMembers: SplitMember[] | undefined;
  let splitWith: string[] | undefined;
  if (ledger && !ledger.is_personal) {
    const [members, existingSplits] = await Promise.all([
      listMembers(ledgerId),
      listSplits(id),
    ]);
    splitMembers = members.map((m) => ({
      userId: m.user_id,
      name: m.user?.name ?? m.user?.email ?? "?",
      email: m.user?.email ?? null,
      image: m.user?.image ?? null,
      isYou: m.user_id === userId,
    }));
    if (existingSplits.length > 0) {
      // splitWith should include the payer + everyone with a stored share
      splitWith = [tx.user_id, ...existingSplits.map((s) => s.user_id)];
    }
  }

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
        initial={{
          id: tx.id,
          kind: tx.kind,
          amount: Number(tx.amount),
          categoryId: tx.category_id,
          note: tx.note,
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
