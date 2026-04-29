import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveActiveLedger } from "@/lib/active-ledger";
import { getServerSupabase } from "@/lib/supabase/server";

export type LedgerRole = "owner" | "editor" | "viewer";

export type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type SessionContext = {
  userId: string;
  ledgerId: string;
  role: LedgerRole;
  user: SessionUser;
};

/**
 * Protect a server route. Returns userId, the active ledger, and the role
 * the user has on it. Always validates ledger membership.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const ledgerId = await resolveActiveLedger(userId);

  const sb = getServerSupabase();
  const { data: owned } = await sb
    .from("ledgers")
    .select("owner_id")
    .eq("id", ledgerId)
    .single();

  let role: LedgerRole = "viewer";
  if (owned?.owner_id === userId) {
    role = "owner";
  } else {
    const { data: member } = await sb
      .from("ledger_members")
      .select("role")
      .eq("ledger_id", ledgerId)
      .eq("user_id", userId)
      .maybeSingle();
    role = (member?.role as LedgerRole) ?? "viewer";
  }

  return { userId, ledgerId, role, user: session!.user as SessionUser };
}

export function assertWritable(role: LedgerRole) {
  if (role === "viewer") {
    throw new Error("คุณไม่มีสิทธิ์แก้ไขสมุดเล่มนี้ (viewer only)");
  }
}

export function assertOwner(role: LedgerRole) {
  if (role !== "owner") {
    throw new Error("เฉพาะเจ้าของสมุดเท่านั้นที่ทำการนี้ได้");
  }
}
