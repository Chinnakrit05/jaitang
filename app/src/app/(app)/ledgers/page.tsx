import { listLedgersForUser } from "@/lib/ledgers";
import { requireSession } from "@/lib/session";
import Link from "next/link";
import { LedgerCard } from "@/components/ledger-card";
import { CreateLedgerForm } from "@/components/create-ledger-form";

export default async function LedgersPage() {
  const { userId, ledgerId: activeLedgerId } = await requireSession();
  const ledgers = await listLedgersForUser(userId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">สมุดบัญชี</h1>
        <p className="text-sm text-(--muted) mt-1">
          สมุดส่วนตัว + สมุดที่แชร์กับคนอื่น — กดเพื่อสลับสมุดที่กำลังใช้
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ledgers.map((l) => (
          <LedgerCard
            key={l.id}
            ledger={l}
            isActive={l.id === activeLedgerId}
          />
        ))}
      </ul>

      <CreateLedgerForm />

      <p className="text-xs text-(--muted)">
        ต้องการเข้าร่วมสมุดที่คนอื่นแชร์? ใช้ลิงก์เชิญในรูปแบบ{" "}
        <code className="px-1 py-0.5 rounded bg-(--card) border border-(--border)">
          /invite/&lt;รหัส&gt;
        </code>{" "}
        หรือไปหน้า{" "}
        <Link href="/invite" className="text-(--accent) hover:underline">
          ใส่รหัสเชิญ
        </Link>
      </p>
    </div>
  );
}
