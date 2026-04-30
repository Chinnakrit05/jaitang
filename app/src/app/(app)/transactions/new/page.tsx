import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { NewTransactionPage } from "@/components/new-transaction-page";
import { createTransactionAction } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewTransaction() {
  const { ledgerId } = await requireSession();
  const categories = await listCategories(ledgerId);
  const ocrEnabled = !!process.env.ANTHROPIC_API_KEY;

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
      <NewTransactionPage
        categories={categories}
        action={createTransactionAction}
        ocrEnabled={ocrEnabled}
      />
    </div>
  );
}
