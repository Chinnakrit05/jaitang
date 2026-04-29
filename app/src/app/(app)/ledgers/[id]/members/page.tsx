import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/members";
import { listInvitesForLedger } from "@/lib/invites";
import { MembersPanel } from "@/components/members-panel";
import { InvitesPanel } from "@/components/invites-panel";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const { id: ledgerId } = await params;

  const sb = getServerSupabase();
  const { data: ledger } = await sb
    .from("ledgers")
    .select("id, name, icon, owner_id, is_personal")
    .eq("id", ledgerId)
    .maybeSingle();

  if (!ledger) notFound();
  if (ledger.is_personal) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-(--muted)">สมุดส่วนตัวไม่มีระบบสมาชิก</p>
      </div>
    );
  }

  const isOwner = ledger.owner_id === userId;
  if (!isOwner) {
    redirect("/ledgers");
  }

  const [members, invites] = await Promise.all([
    listMembers(ledgerId),
    listInvitesForLedger(ledgerId),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/ledgers"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
      >
        <ArrowLeft size={16} />
        กลับไปสมุดบัญชี
      </Link>

      <div className="flex items-center gap-3">
        <span className="text-3xl">{ledger.icon ?? "📒"}</span>
        <div>
          <h1 className="text-2xl font-bold">{ledger.name}</h1>
          <p className="text-sm text-(--muted)">จัดการสมาชิกและลิงก์เชิญ</p>
        </div>
      </div>

      <section>
        <h2 className="font-semibold mb-3">สมาชิก ({members.length})</h2>
        <MembersPanel members={members} currentUserId={userId} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">ลิงก์เชิญ</h2>
        <InvitesPanel ledgerId={ledgerId} invites={invites} />
      </section>
    </div>
  );
}
