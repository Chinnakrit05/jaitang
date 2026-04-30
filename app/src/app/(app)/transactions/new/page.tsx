import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { NewTransactionPage } from "@/components/new-transaction-page";
import { createTransactionAction } from "../actions";
import { getServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/members";
import type { SplitMember } from "@/components/transaction-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewTransaction() {
  const { ledgerId, userId } = await requireSession();
  const categories = await listCategories(ledgerId);
  const ocrEnabled = !!process.env.ANTHROPIC_API_KEY;

  const sb = getServerSupabase();
  const { data: ledger } = await sb
    .from("ledgers")
    .select("is_personal")
    .eq("id", ledgerId)
    .single();

  let splitMembers: SplitMember[] | undefined;
  if (ledger && !ledger.is_personal) {
    const members = await listMembers(ledgerId);
    splitMembers = members.map((m) => ({
      userId: m.user_id,
      name: m.user?.name ?? m.user?.email ?? "?",
      email: m.user?.email ?? null,
      image: m.user?.image ?? null,
      isYou: m.user_id === userId,
    }));
  }

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
        splitMembers={splitMembers}
      />
    </div>
  );
}
