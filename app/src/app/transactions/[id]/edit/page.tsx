import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { TransactionForm } from "@/components/transaction-form";
import { updateTransactionAction, deleteTransactionAction } from "../../actions";
import { getServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DeleteForm } from "./delete-form";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ledgerId } = await requireSession();

  const sb = getServerSupabase();
  const { data: tx, error } = await sb
    .from("transactions")
    .select("id, ledger_id, kind, amount, category_id, note, occurred_at")
    .eq("id", id)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  if (error) throw error;
  if (!tx) notFound();

  const categories = await listCategories(ledgerId);
  const boundAction = updateTransactionAction.bind(null, id);

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground) mb-4"
      >
        <ArrowLeft size={16} />
        กลับ
      </Link>
      <h1 className="text-2xl font-bold mb-6">แก้ไขรายการ</h1>
      <TransactionForm
        categories={categories}
        initial={{
          id: tx.id,
          kind: tx.kind,
          amount: Number(tx.amount),
          categoryId: tx.category_id,
          note: tx.note,
          occurredAt: tx.occurred_at,
        }}
        action={boundAction}
        submitLabel="อัปเดต"
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
