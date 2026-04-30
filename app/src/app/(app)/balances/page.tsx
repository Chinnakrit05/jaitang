import { requireSession } from "@/lib/session";
import { computeLedgerBalances } from "@/lib/splits";
import { getServerSupabase } from "@/lib/supabase/server";
import { BalancesPanel } from "@/components/balances-panel";
import Link from "next/link";

export default async function BalancesPage() {
  const { ledgerId, userId } = await requireSession();

  const sb = getServerSupabase();
  const { data: ledger } = await sb
    .from("ledgers")
    .select("name, icon, is_personal")
    .eq("id", ledgerId)
    .single();

  if (ledger?.is_personal) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">ยอดหนี้-เครดิต</h1>
          <p className="text-sm text-(--muted) mt-1">
            ฟีเจอร์นี้ใช้เฉพาะสมุดแชร์เท่านั้น
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/50 p-10 text-center">
          <span className="text-4xl mb-3 block">👥</span>
          <p className="font-medium mb-1">ตอนนี้คุณอยู่ในสมุดส่วนตัว</p>
          <p className="text-sm text-(--muted) mb-4">
            สลับไปสมุดแชร์เพื่อดูยอดหารบิล
          </p>
          <Link
            href="/ledgers"
            className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm"
          >
            เปลี่ยนสมุด
          </Link>
        </div>
      </div>
    );
  }

  const balances = await computeLedgerBalances(ledgerId);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {ledger?.icon ?? "👥"} ยอดหนี้-เครดิต
        </h1>
        <p className="text-sm text-(--muted) mt-1">
          สรุปยอดหารบิลใน{ledger?.name ? <strong> {ledger.name}</strong> : "สมุดนี้"} —
          ใครติดเงินใครเท่าไหร่ (หักลบสองทางแล้ว)
        </p>
      </div>

      <BalancesPanel balances={balances} currentUserId={userId} />
    </div>
  );
}
