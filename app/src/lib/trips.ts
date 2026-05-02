import { getServerSupabase } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

export type TripStats = Trip & {
  /** Number of transactions tagged with this trip. */
  txCount: number;
  /** Sum of expense rows in this trip. */
  totalExpense: number;
  /** Sum of income rows in this trip. */
  totalIncome: number;
};

/**
 * List all trips in a ledger, with per-trip totals computed in JS.
 * For a household ledger this is small (<100 rows). Move to a SQL view
 * if it ever gets hot.
 *
 * `includeArchived = false` returns only active trips, which is what the
 * trips list page wants by default; pass `true` to also see history.
 */
export async function listTrips(
  ledgerId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<TripStats[]> {
  const sb = getServerSupabase();

  let q = sb
    .from("trips")
    .select("id, ledger_id, name, icon, color, starts_at, ends_at, archived, created_at")
    .eq("ledger_id", ledgerId);
  if (!opts.includeArchived) q = q.eq("archived", false);
  q = q.order("archived", { ascending: true })
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data: trips, error } = await q;
  if (error) throw error;
  if (!trips || trips.length === 0) return [];

  const ids = trips.map((t) => t.id);
  const { data: txRows, error: txErr } = await sb
    .from("transactions")
    .select("trip_id, kind, amount")
    .in("trip_id", ids);
  if (txErr) throw txErr;

  const stats = new Map<string, { count: number; income: number; expense: number }>();
  for (const id of ids) stats.set(id, { count: 0, income: 0, expense: 0 });
  for (const row of txRows ?? []) {
    if (!row.trip_id) continue;
    const s = stats.get(row.trip_id);
    if (!s) continue;
    s.count += 1;
    const amount = Number(row.amount);
    if (row.kind === "income") s.income += amount;
    else s.expense += amount;
  }

  return trips.map((t) => {
    const s = stats.get(t.id) ?? { count: 0, income: 0, expense: 0 };
    return {
      ...t,
      txCount: s.count,
      totalIncome: s.income,
      totalExpense: s.expense,
    };
  });
}

export async function getTrip(
  tripId: string,
  ledgerId: string
): Promise<Trip | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("trips")
    .select("id, ledger_id, name, icon, color, starts_at, ends_at, archived, created_at")
    .eq("id", tripId)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  if (error) throw error;
  return (data as Trip | null) ?? null;
}

export async function createTrip(input: {
  ledgerId: string;
  name: string;
  icon?: string;
  color?: string;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<Trip> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("trips")
    .insert({
      ledger_id: input.ledgerId,
      name: input.name,
      icon: input.icon ?? "✈️",
      color: input.color ?? "#3b82f6",
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

export async function updateTrip(
  tripId: string,
  ledgerId: string,
  patch: Partial<{
    name: string;
    icon: string | null;
    color: string | null;
    startsAt: string | null;
    endsAt: string | null;
    archived: boolean;
  }>
): Promise<Trip> {
  const sb = getServerSupabase();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.icon !== undefined) update.icon = patch.icon;
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;
  if (patch.archived !== undefined) update.archived = patch.archived;

  const { data, error } = await sb
    .from("trips")
    .update(update)
    .eq("id", tripId)
    .eq("ledger_id", ledgerId)
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
}

/**
 * Delete a trip. Transactions tagged with this trip are NOT deleted —
 * the FK is `on delete set null`, so they revert to "no trip" and remain
 * in the user's history. The user's spend record is preserved.
 */
export async function deleteTrip(tripId: string, ledgerId: string): Promise<void> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("ledger_id", ledgerId);
  if (error) throw error;
}

/**
 * Detach a single transaction from its trip — the row stays put, just
 * loses the trip tag. Restricted to the same ledger as a defense check
 * (the caller already does session-level auth).
 */
export async function removeTransactionFromTrip(
  txId: string,
  ledgerId: string
): Promise<void> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("transactions")
    .update({ trip_id: null })
    .eq("id", txId)
    .eq("ledger_id", ledgerId);
  if (error) throw error;
}
