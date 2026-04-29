import { getServerSupabase } from "@/lib/supabase/server";
import type { LedgerRole } from "@/lib/session";

function generateCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // skip 0/O/I/1
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function createInvite(opts: {
  ledgerId: string;
  createdBy: string;
  role: Exclude<LedgerRole, "owner">;
  maxUses?: number;
  expiresAt?: Date | null;
}) {
  const sb = getServerSupabase();
  // try a few times in the unlikely case of a code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await sb
      .from("invites")
      .insert({
        ledger_id: opts.ledgerId,
        code,
        role: opts.role,
        max_uses: opts.maxUses ?? 1,
        used_count: 0,
        expires_at: opts.expiresAt?.toISOString() ?? null,
        created_by: opts.createdBy,
      })
      .select()
      .single();
    if (!error && data) return data;
    if (error && !error.message.includes("invites_code_key")) throw error;
  }
  throw new Error("Failed to allocate invite code");
}

export async function getInviteByCode(code: string) {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("invites")
    .select(
      "id, ledger_id, code, role, max_uses, used_count, expires_at, created_by, created_at, ledger:ledgers(id, name, icon, color)"
    )
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const ledger = (Array.isArray(data.ledger) ? data.ledger[0] : data.ledger) ?? null;
  return { ...data, ledger };
}

export async function consumeInvite(opts: {
  code: string;
  userId: string;
}): Promise<{ ledgerId: string; role: LedgerRole }> {
  const sb = getServerSupabase();
  const invite = await getInviteByCode(opts.code);
  if (!invite) throw new Error("ลิงก์เชิญนี้ไม่ถูกต้อง หรือถูกลบแล้ว");

  if (invite.used_count >= invite.max_uses) {
    throw new Error("ลิงก์เชิญนี้ใช้ครบจำนวนแล้ว");
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    throw new Error("ลิงก์เชิญนี้หมดอายุแล้ว");
  }

  // Already a member?
  const { data: existingMember } = await sb
    .from("ledger_members")
    .select("role")
    .eq("ledger_id", invite.ledger_id)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (existingMember) {
    return { ledgerId: invite.ledger_id, role: existingMember.role as LedgerRole };
  }

  // Owner?
  const { data: ownedLedger } = await sb
    .from("ledgers")
    .select("id")
    .eq("id", invite.ledger_id)
    .eq("owner_id", opts.userId)
    .maybeSingle();
  if (ownedLedger) {
    return { ledgerId: invite.ledger_id, role: "owner" };
  }

  const { error: insertErr } = await sb.from("ledger_members").insert({
    ledger_id: invite.ledger_id,
    user_id: opts.userId,
    role: invite.role,
  });
  if (insertErr) throw insertErr;

  await sb
    .from("invites")
    .update({ used_count: invite.used_count + 1 })
    .eq("id", invite.id);

  return { ledgerId: invite.ledger_id, role: invite.role as LedgerRole };
}

export async function listInvitesForLedger(ledgerId: string) {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("invites")
    .select("id, code, role, max_uses, used_count, expires_at, created_at")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteInvite(id: string) {
  const sb = getServerSupabase();
  const { error } = await sb.from("invites").delete().eq("id", id);
  if (error) throw error;
}
