import { cache } from "react";
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

export type ActiveLedgerInfo = {
  id: string;
  name: string;
  icon: string | null;
  is_personal: boolean;
  currency: string;
};

export type SessionContext = {
  userId: string;
  ledgerId: string;
  role: LedgerRole;
  user: SessionUser;
  ledger: ActiveLedgerInfo;
};

/**
 * Protect a server route. Returns userId, the active ledger (full object),
 * and the user's role on it.
 *
 * Wrapped in React's `cache()` so layout + page + nested components inside
 * the same request all share one resolution. Without this, every protected
 * page hit Auth + 2-3 Supabase round trips repeatedly.
 *
 * Single ledger fetch returns the columns both layout AND pages need
 * (id, name, icon, currency, is_personal, owner_id) — we no longer query
 * the ledger again from the layout.
 */
export const requireSession = cache(async (): Promise<SessionContext> => {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const ledgerId = await resolveActiveLedger(userId);

  const sb = getServerSupabase();
  const { data: ledgerRow, error: lErr } = await sb
    .from("ledgers")
    .select("id, name, icon, currency, is_personal, owner_id")
    .eq("id", ledgerId)
    .single();
  if (lErr || !ledgerRow) {
    // Ledger we cookied is gone — bail to a fresh personal ledger next render.
    redirect("/ledgers");
  }

  let role: LedgerRole = "viewer";
  if (ledgerRow.owner_id === userId) {
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

  return {
    userId,
    ledgerId,
    role,
    user: session!.user as SessionUser,
    ledger: {
      id: ledgerRow.id,
      name: ledgerRow.name,
      icon: ledgerRow.icon,
      is_personal: ledgerRow.is_personal,
      currency: ledgerRow.currency ?? "THB",
    },
  };
});

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
