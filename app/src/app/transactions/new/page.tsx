import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { TransactionForm } from "@/components/transaction-form";
import { createTransactionAction } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewTransactionPage() {
  const { ledgerId } = await requireSession();
  const categories = await listCategories(ledgerId);

  return (
    <div className="max-w-xl mx-auto">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground) mb-4"
      >
        <ArrowLeft size={16} />
        กลับ
      </Link>
      <h1 className="text-2xl font-bold mb-6">เพิ่มรายการ</h1>
      <TransactionForm
        categories={categories}
        action={createTransactionAction}
        submitLabel="บันทึก"
      />
    </div>
  );
}
