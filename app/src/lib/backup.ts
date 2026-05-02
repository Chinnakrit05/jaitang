import { getServerSupabase } from "@/lib/supabase/server";
import { listLedgersForUser } from "@/lib/ledgers";
import { z } from "zod";

export const BACKUP_VERSION = 1;

export type BackupCategory = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: "income" | "expense";
  sort_order: number;
};

export type BackupTransaction = {
  id: string;
  category_id: string | null;
  kind: "income" | "expense";
  amount: number;
  note: string | null;
  // Optional: pre-payment-method backups don't include this field.
  payment_method?: "cash" | "transfer" | null;
  // Optional: pre-trip backups don't include this field.
  trip_id?: string | null;
  // Optional: pre-FX backups don't include these. Set as a triple or all
  // unset; partial sets are rejected on restore (DB constraint).
  fx_currency?: string | null;
  fx_amount?: number | null;
  fx_rate?: number | null;
  occurred_at: string;
  created_at: string;
};

export type BackupTrip = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  starts_at: string | null;
  ends_at: string | null;
  archived: boolean;
  // Optional: pre-multi-currency backups don't include this.
  currency?: string | null;
};

export type BackupBudget = {
  category_id: string;
  amount: number;
  period: "month";
};

export type BackupRecurring = {
  id: string;
  category_id: string | null;
  kind: "income" | "expense";
  amount: number;
  note: string | null;
  period: "daily" | "weekly" | "monthly";
  day_of_month: number | null;
  day_of_week: number | null;
  next_run_at: string;
  active: boolean;
};

export type BackupSplit = {
  transaction_id: string;
  user_email: string | null; // we store email for cross-user restore (best-effort)
  amount: number;
  settled: boolean;
  settled_at: string | null;
};

export type BackupLedger = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  currency: string;
  is_personal: boolean;
  is_owned: boolean; // true if the exporting user owns this ledger
  role: "owner" | "editor" | "viewer";
  categories: BackupCategory[];
  transactions: BackupTransaction[];
  budgets: BackupBudget[];
  recurring: BackupRecurring[];
  splits: BackupSplit[];
  // Optional: pre-trip backups don't include this field.
  trips?: BackupTrip[];
};

export type BackupFile = {
  version: number;
  exported_at: string;
  user: { email: string | null; name: string | null };
  ledgers: BackupLedger[];
};

/**
 * Collect everything the user can see — every ledger they own + every shared
 * ledger they're a member of, with full data for each. Owned ledgers carry
 * `is_owned: true` so the import path knows which ones it's allowed to recreate.
 */
export async function collectBackup(userId: string): Promise<BackupFile> {
  const sb = getServerSupabase();
  const ledgers = await listLedgersForUser(userId);

  const { data: userRow } = await sb
    .from("users")
    .select("email, name")
    .eq("id", userId)
    .single();

  const out: BackupLedger[] = [];

  for (const l of ledgers) {
    const [catsRes, txRes, budgetsRes, recurRes, tripsRes] = await Promise.all([
      sb
        .from("categories")
        .select("id, name, icon, color, kind, sort_order")
        .eq("ledger_id", l.id)
        .order("kind")
        .order("sort_order"),
      sb
        .from("transactions")
        .select(
          "id, category_id, trip_id, kind, amount, note, payment_method, fx_currency, fx_amount, fx_rate, occurred_at, created_at"
        )
        .eq("ledger_id", l.id)
        .order("occurred_at"),
      sb
        .from("budgets")
        .select("category_id, amount, period")
        .eq("ledger_id", l.id),
      sb
        .from("recurring_transactions")
        .select(
          "id, category_id, kind, amount, note, period, day_of_month, day_of_week, next_run_at, active"
        )
        .eq("ledger_id", l.id),
      sb
        .from("trips")
        .select("id, name, icon, color, starts_at, ends_at, archived, currency")
        .eq("ledger_id", l.id),
    ]);

    if (catsRes.error) throw catsRes.error;
    if (txRes.error) throw txRes.error;
    if (budgetsRes.error) throw budgetsRes.error;
    if (recurRes.error) throw recurRes.error;
    if (tripsRes.error) throw tripsRes.error;

    // Splits: pull all splits whose parent tx belongs to this ledger.
    // We embed user_email so cross-user restores have a chance of routing.
    const txIds = (txRes.data ?? []).map((t) => t.id);
    let splits: BackupSplit[] = [];
    if (txIds.length > 0) {
      const { data: rawSplits, error: splitErr } = await sb
        .from("transaction_splits")
        .select(
          "transaction_id, user_id, amount, settled, settled_at, user:users(email)"
        )
        .in("transaction_id", txIds);
      if (splitErr) throw splitErr;
      splits = (rawSplits ?? []).map((s) => {
        const u = Array.isArray(s.user) ? s.user[0] : s.user;
        return {
          transaction_id: s.transaction_id as string,
          user_email: (u as { email?: string } | null)?.email ?? null,
          amount: Number(s.amount),
          settled: s.settled,
          settled_at: s.settled_at,
        };
      });
    }

    out.push({
      id: l.id,
      name: l.name,
      icon: l.icon,
      color: l.color,
      currency: l.currency,
      is_personal: l.is_personal,
      is_owned: l.role === "owner",
      role: l.role,
      categories: (catsRes.data ?? []).map((c) => ({
        ...c,
        amount: undefined as never, // appease ts
      })) as BackupCategory[],
      transactions: (txRes.data ?? []).map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
      budgets: (budgetsRes.data ?? []).map((b) => ({
        category_id: b.category_id as string,
        amount: Number(b.amount),
        period: b.period as "month",
      })),
      recurring: (recurRes.data ?? []).map((r) => ({
        ...r,
        amount: Number(r.amount),
      })) as BackupRecurring[],
      splits,
      trips: (tripsRes.data ?? []) as BackupTrip[],
    });
  }

  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    user: { email: userRow?.email ?? null, name: userRow?.name ?? null },
    ledgers: out,
  };
}

// ---------- Restore ----------

const BackupSchema = z.object({
  version: z.number(),
  exported_at: z.string().optional(),
  user: z.object({ email: z.string().nullable(), name: z.string().nullable() }).optional(),
  ledgers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      icon: z.string().nullable(),
      color: z.string().nullable(),
      currency: z.string().default("THB"),
      is_personal: z.boolean(),
      is_owned: z.boolean(),
      role: z.enum(["owner", "editor", "viewer"]).optional(),
      categories: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          icon: z.string().nullable(),
          color: z.string().nullable(),
          kind: z.enum(["income", "expense"]),
          sort_order: z.number(),
        })
      ),
      transactions: z.array(
        z.object({
          id: z.string(),
          category_id: z.string().nullable(),
          trip_id: z.string().nullable().optional(),
          kind: z.enum(["income", "expense"]),
          amount: z.number().positive(),
          note: z.string().nullable(),
          payment_method: z.enum(["cash", "transfer"]).nullable().optional(),
          fx_currency: z.string().min(3).max(3).nullable().optional(),
          fx_amount: z.number().positive().nullable().optional(),
          fx_rate: z.number().positive().nullable().optional(),
          occurred_at: z.string(),
          created_at: z.string().optional(),
        })
      ),
      trips: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            icon: z.string().nullable(),
            color: z.string().nullable(),
            starts_at: z.string().nullable(),
            ends_at: z.string().nullable(),
            archived: z.boolean(),
            currency: z.string().min(3).max(3).nullable().optional(),
          })
        )
        .optional(),
      budgets: z.array(
        z.object({
          category_id: z.string(),
          amount: z.number().positive(),
          period: z.literal("month"),
        })
      ),
      recurring: z.array(
        z.object({
          id: z.string(),
          category_id: z.string().nullable(),
          kind: z.enum(["income", "expense"]),
          amount: z.number().positive(),
          note: z.string().nullable(),
          period: z.enum(["daily", "weekly", "monthly"]),
          day_of_month: z.number().nullable(),
          day_of_week: z.number().nullable(),
          next_run_at: z.string(),
          active: z.boolean(),
        })
      ),
      splits: z
        .array(
          z.object({
            transaction_id: z.string(),
            user_email: z.string().nullable(),
            amount: z.number().positive(),
            settled: z.boolean(),
            settled_at: z.string().nullable(),
          })
        )
        .optional(),
    })
  ),
});

export type RestoreSummary = {
  ledgersCreated: number;
  categoriesCreated: number;
  transactionsCreated: number;
  budgetsCreated: number;
  recurringCreated: number;
  splitsCreated: number;
  tripsCreated: number;
  ledgersSkipped: number; // shared ledgers we couldn't recreate
};

/**
 * Restore: recreate every owned ledger + its data under fresh ids. Shared
 * (non-owned) ledgers in the backup are skipped — the user has no authority
 * to recreate those (they belong to someone else).
 *
 * Each restore creates NEW rows. Two restores from the same backup will
 * produce two copies. We don't try to dedupe across runs.
 */
export async function restoreBackup(
  backup: unknown,
  userId: string
): Promise<RestoreSummary> {
  const parsed = BackupSchema.parse(backup);

  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup version ${parsed.version} not supported (expected ${BACKUP_VERSION})`
    );
  }

  const sb = getServerSupabase();
  const summary: RestoreSummary = {
    ledgersCreated: 0,
    categoriesCreated: 0,
    transactionsCreated: 0,
    budgetsCreated: 0,
    recurringCreated: 0,
    splitsCreated: 0,
    tripsCreated: 0,
    ledgersSkipped: 0,
  };

  // For email-based split routing
  const emailToUserId = new Map<string, string>();

  for (const lb of parsed.ledgers) {
    if (!lb.is_owned) {
      summary.ledgersSkipped++;
      continue;
    }

    // Prevent creating a second personal ledger (uniq constraint would reject anyway)
    let createdLedgerId: string | null = null;
    if (lb.is_personal) {
      const { data: existing } = await sb
        .from("ledgers")
        .select("id")
        .eq("owner_id", userId)
        .eq("is_personal", true)
        .maybeSingle();
      if (existing) {
        createdLedgerId = existing.id;
      }
    }

    if (!createdLedgerId) {
      const { data: newLedger, error: lerr } = await sb
        .from("ledgers")
        .insert({
          name: lb.is_personal ? lb.name : `${lb.name} (restored)`,
          icon: lb.icon,
          color: lb.color,
          currency: lb.currency,
          owner_id: userId,
          is_personal: lb.is_personal,
        })
        .select("id")
        .single();
      if (lerr) throw lerr;
      createdLedgerId = newLedger!.id;
      summary.ledgersCreated++;
    }

    // Trips — map oldId → newId so transactions can re-link to them.
    // Done before transactions for that reason.
    const tripMap = new Map<string, string>();
    if (lb.trips && lb.trips.length > 0) {
      for (const tr of lb.trips) {
        const { data: nt, error: terr } = await sb
          .from("trips")
          .insert({
            ledger_id: createdLedgerId!,
            name: tr.name,
            icon: tr.icon,
            color: tr.color,
            currency: tr.currency ?? null,
            starts_at: tr.starts_at,
            ends_at: tr.ends_at,
            archived: tr.archived,
          })
          .select("id")
          .single();
        if (terr) throw terr;
        tripMap.set(tr.id, nt!.id);
        summary.tripsCreated++;
      }
    }

    // Categories — map oldId → newId
    const catMap = new Map<string, string>();
    if (lb.categories.length > 0) {
      const rows = lb.categories.map((c) => ({
        ledger_id: createdLedgerId!,
        name: c.name,
        icon: c.icon,
        color: c.color,
        kind: c.kind,
        sort_order: c.sort_order,
      }));
      // Insert one-by-one so we can map old→new ids in order
      for (let i = 0; i < lb.categories.length; i++) {
        const { data: nc, error: cerr } = await sb
          .from("categories")
          .insert(rows[i])
          .select("id")
          .single();
        if (cerr) throw cerr;
        catMap.set(lb.categories[i].id, nc!.id);
        summary.categoriesCreated++;
      }
    }

    // Transactions — map oldId → newId for splits
    const txMap = new Map<string, string>();
    if (lb.transactions.length > 0) {
      // Bulk insert in chunks of 200 for speed; afterwards we can't recover ids in order
      // for splits, so do row-by-row when there are any splits.
      const hasSplits = (lb.splits ?? []).length > 0;
      // FX must satisfy the all-or-none constraint; partials drop to null.
      const fxOf = (t: {
        fx_currency?: string | null;
        fx_amount?: number | null;
        fx_rate?: number | null;
      }) => {
        const ok =
          !!t.fx_currency &&
          t.fx_amount !== null &&
          t.fx_amount !== undefined &&
          t.fx_rate !== null &&
          t.fx_rate !== undefined;
        return ok
          ? {
              fx_currency: t.fx_currency!,
              fx_amount: t.fx_amount!,
              fx_rate: t.fx_rate!,
            }
          : { fx_currency: null, fx_amount: null, fx_rate: null };
      };

      if (hasSplits) {
        for (const t of lb.transactions) {
          const { data: nt, error: terr } = await sb
            .from("transactions")
            .insert({
              ledger_id: createdLedgerId!,
              user_id: userId,
              category_id: t.category_id ? catMap.get(t.category_id) ?? null : null,
              trip_id: t.trip_id ? tripMap.get(t.trip_id) ?? null : null,
              kind: t.kind,
              amount: t.amount,
              note: t.note,
              payment_method: t.payment_method ?? null,
              ...fxOf(t),
              occurred_at: t.occurred_at,
            })
            .select("id")
            .single();
          if (terr) throw terr;
          txMap.set(t.id, nt!.id);
          summary.transactionsCreated++;
        }
      } else {
        const rows = lb.transactions.map((t) => ({
          ledger_id: createdLedgerId!,
          user_id: userId,
          category_id: t.category_id ? catMap.get(t.category_id) ?? null : null,
          trip_id: t.trip_id ? tripMap.get(t.trip_id) ?? null : null,
          kind: t.kind,
          amount: t.amount,
          note: t.note,
          payment_method: t.payment_method ?? null,
          ...fxOf(t),
          occurred_at: t.occurred_at,
        }));
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error: terr } = await sb.from("transactions").insert(chunk);
          if (terr) throw terr;
          summary.transactionsCreated += chunk.length;
        }
      }
    }

    // Budgets
    if (lb.budgets.length > 0) {
      const rows = lb.budgets
        .map((b) => {
          const newCatId = catMap.get(b.category_id);
          if (!newCatId) return null;
          return {
            ledger_id: createdLedgerId!,
            category_id: newCatId,
            amount: b.amount,
            period: b.period,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (rows.length > 0) {
        const { error: berr } = await sb.from("budgets").insert(rows);
        if (berr) throw berr;
        summary.budgetsCreated += rows.length;
      }
    }

    // Recurring
    if (lb.recurring.length > 0) {
      const rows = lb.recurring.map((r) => ({
        ledger_id: createdLedgerId!,
        user_id: userId,
        category_id: r.category_id ? catMap.get(r.category_id) ?? null : null,
        kind: r.kind,
        amount: r.amount,
        note: r.note,
        period: r.period,
        day_of_month: r.day_of_month,
        day_of_week: r.day_of_week,
        next_run_at: r.next_run_at,
        active: r.active,
      }));
      const { error: rerr } = await sb.from("recurring_transactions").insert(rows);
      if (rerr) throw rerr;
      summary.recurringCreated += rows.length;
    }

    // Splits — best-effort: route by email; if unknown, skip silently
    if (lb.splits && lb.splits.length > 0) {
      const splitRows: Array<{
        transaction_id: string;
        user_id: string;
        amount: number;
        settled: boolean;
        settled_at: string | null;
      }> = [];
      for (const s of lb.splits) {
        const newTxId = txMap.get(s.transaction_id);
        if (!newTxId) continue;
        if (!s.user_email) continue;
        let resolvedUserId = emailToUserId.get(s.user_email);
        if (!resolvedUserId) {
          const { data: u } = await sb
            .from("users")
            .select("id")
            .eq("email", s.user_email)
            .maybeSingle();
          if (!u) continue;
          resolvedUserId = u.id as string;
          emailToUserId.set(s.user_email, resolvedUserId);
        }
        if (!resolvedUserId) continue;
        splitRows.push({
          transaction_id: newTxId,
          user_id: resolvedUserId,
          amount: s.amount,
          settled: s.settled,
          settled_at: s.settled_at,
        });
      }
      if (splitRows.length > 0) {
        const { error: serr } = await sb
          .from("transaction_splits")
          .insert(splitRows);
        if (serr) throw serr;
        summary.splitsCreated += splitRows.length;
      }
    }
  }

  return summary;
}
