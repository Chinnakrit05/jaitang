import { getServerSupabase } from "@/lib/supabase/server";

export type LedgerSummary = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  currency: string;
  is_personal: boolean;
  owner_id: string;
  created_at: string;
  role: "owner" | "editor" | "viewer";
};

/**
 * Ensure the user has at least one personal ledger.
 * Idempotent — safe to call on every login or dashboard visit.
 */
export async function ensurePersonalLedger(userId: string) {
  const sb = getServerSupabase();

  // .order + .limit(1) + .maybeSingle is defensive: even if duplicates somehow
  // exist (pre-uniq-index data, manual inserts), we deterministically pick the
  // oldest and never throw PGRST116.
  const { data: existing, error: lookupErr } = await sb
    .from("ledgers")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_personal", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (lookupErr) throw lookupErr;
  if (existing) return existing.id as string;

  const { data: created, error: createErr } = await sb
    .from("ledgers")
    .insert({
      name: "สมุดส่วนตัว",
      icon: "📒",
      color: "#4cc9f0",
      currency: "THB",
      owner_id: userId,
      is_personal: true,
    })
    .select("id")
    .single();

  if (createErr) {
    // Lost the race with another concurrent insert — partial unique index
    // (ledgers WHERE is_personal=true) rejected us. Re-read what survived.
    if (createErr.code === "23505") {
      const { data: winner } = await sb
        .from("ledgers")
        .select("id")
        .eq("owner_id", userId)
        .eq("is_personal", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (winner) return winner.id as string;
    }
    throw createErr;
  }
  if (!created) throw new Error("Failed to create personal ledger");

  const { error: seedErr } = await sb.rpc("seed_default_categories", {
    _ledger_id: created.id,
  });
  if (seedErr) throw seedErr;

  return created.id as string;
}

/**
 * Return all ledgers the user can see: ones they own + ones they're a member of.
 * Two queries; merged client-side. Postgres-side join would be nicer once RLS lands.
 */
export async function listLedgersForUser(userId: string): Promise<LedgerSummary[]> {
  const sb = getServerSupabase();

  const [ownedRes, memberRes] = await Promise.all([
    sb
      .from("ledgers")
      .select("id, name, icon, color, currency, is_personal, owner_id, created_at")
      .eq("owner_id", userId)
      .is("deleted_at", null),
    sb
      .from("ledger_members")
      .select(
        "role, ledgers!inner(id, name, icon, color, currency, is_personal, owner_id, created_at)"
      )
      .eq("user_id", userId)
      // Filter on the joined `ledgers` table — PostgREST allows this even
      // when the column isn't projected in the select.
      .is("ledgers.deleted_at", null),
  ]);

  if (ownedRes.error) throw ownedRes.error;
  if (memberRes.error) throw memberRes.error;

  const owned: LedgerSummary[] = (ownedRes.data ?? []).map((l) => ({
    ...l,
    role: "owner" as const,
  }));

  const memberships: LedgerSummary[] = (memberRes.data ?? [])
    .map((m) => {
      const ledger = (Array.isArray(m.ledgers) ? m.ledgers[0] : m.ledgers) as
        | Omit<LedgerSummary, "role">
        | null;
      if (!ledger) return null;
      return { ...ledger, role: m.role as LedgerSummary["role"] };
    })
    .filter((x): x is LedgerSummary => x !== null);

  // De-dupe (shouldn't happen since you can't be both owner & member, but be safe)
  const seen = new Set<string>();
  const merged = [...owned, ...memberships].filter((l) => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });

  return merged.sort((a, b) => {
    if (a.is_personal !== b.is_personal) return a.is_personal ? -1 : 1;
    return a.created_at.localeCompare(b.created_at);
  });
}
