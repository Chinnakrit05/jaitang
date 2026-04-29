import { getServerSupabase } from "@/lib/supabase/server";
import type { LedgerRole } from "@/lib/session";

export type Member = {
  id: string;
  user_id: string;
  role: LedgerRole;
  joined_at: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

export async function listMembers(ledgerId: string): Promise<Member[]> {
  const sb = getServerSupabase();

  const { data: ledger, error: ledgerErr } = await sb
    .from("ledgers")
    .select("owner_id, owner:users!ledgers_owner_id_fkey(id, name, email, image)")
    .eq("id", ledgerId)
    .single();
  if (ledgerErr) throw ledgerErr;

  const { data: rows, error } = await sb
    .from("ledger_members")
    .select("id, user_id, role, joined_at, user:users(id, name, email, image)")
    .eq("ledger_id", ledgerId)
    .order("joined_at", { ascending: true });
  if (error) throw error;

  const owner = (Array.isArray(ledger.owner) ? ledger.owner[0] : ledger.owner) as
    | Member["user"]
    | null;

  const ownerEntry: Member = {
    id: `owner-${ledger.owner_id}`,
    user_id: ledger.owner_id,
    role: "owner",
    joined_at: "0000",
    user: owner,
  };

  const members: Member[] = (rows ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role as LedgerRole,
    joined_at: m.joined_at,
    user: (Array.isArray(m.user) ? m.user[0] : m.user) as Member["user"],
  }));

  return [ownerEntry, ...members];
}

export async function updateMemberRole(memberId: string, role: Exclude<LedgerRole, "owner">) {
  const sb = getServerSupabase();
  const { error } = await sb.from("ledger_members").update({ role }).eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId: string) {
  const sb = getServerSupabase();
  const { error } = await sb.from("ledger_members").delete().eq("id", memberId);
  if (error) throw error;
}
