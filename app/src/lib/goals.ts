import { getServerSupabase } from "@/lib/supabase/server";
import type { Goal, GoalContribution } from "@/lib/types";

export type GoalStats = Goal & {
  /** Sum of contributions to date. */
  currentAmount: number;
  /** 0..1 (or > 1 if user overshot). UI usually clamps to 1 visually. */
  progress: number;
  /** True when current >= target. */
  achieved: boolean;
  /** Approximate full months remaining until deadline. Negative = overdue.
   *  null = no deadline set. */
  monthsRemaining: number | null;
  /** Recommended monthly contribution to hit target by deadline.
   *  null when no deadline OR already achieved OR overdue (use catch-up below).
   *  Always positive when set. */
  monthlyRequired: number | null;
};

/**
 * Approximate elapsed-month count between two dates. We don't try to
 * be calendar-perfect (that would force a Date-fns dep) — millis / 30
 * days is plenty good for "X months left to save Y". Floor so a
 * deadline 5.7 months out reads as "5 months" and the recommended
 * monthly nudges higher (conservative).
 */
function monthsBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (30 * 24 * 3600 * 1000));
}

function buildStats(goal: Goal, currentAmount: number): GoalStats {
  const remaining = goal.target_amount - currentAmount;
  const achieved = currentAmount >= goal.target_amount;
  let monthsRemaining: number | null = null;
  let monthlyRequired: number | null = null;

  if (goal.deadline) {
    monthsRemaining = monthsBetween(new Date(), new Date(goal.deadline));
    if (!achieved && monthsRemaining > 0) {
      monthlyRequired = Math.max(0, remaining) / monthsRemaining;
    }
  }

  return {
    ...goal,
    currentAmount,
    progress: goal.target_amount > 0 ? currentAmount / goal.target_amount : 0,
    achieved,
    monthsRemaining,
    monthlyRequired,
  };
}

/**
 * List goals with totals computed in JS. n is small (<100 typically) —
 * a single roundtrip per ledger is fine. Move to a SQL view if it ever
 * gets hot.
 */
export async function listGoals(
  ledgerId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<GoalStats[]> {
  const sb = getServerSupabase();

  let q = sb
    .from("goals")
    .select(
      "id, ledger_id, name, icon, color, target_amount, deadline, archived, created_at"
    )
    .eq("ledger_id", ledgerId);
  if (!opts.includeArchived) q = q.eq("archived", false);
  q = q
    .order("archived", { ascending: true })
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const { data: goals, error } = await q;
  if (error) throw error;
  if (!goals || goals.length === 0) return [];

  const ids = goals.map((g) => g.id);
  const { data: contribs, error: cErr } = await sb
    .from("goal_contributions")
    .select("goal_id, amount")
    .in("goal_id", ids);
  if (cErr) throw cErr;

  const sumByGoal = new Map<string, number>();
  for (const id of ids) sumByGoal.set(id, 0);
  for (const row of contribs ?? []) {
    const prev = sumByGoal.get(row.goal_id) ?? 0;
    sumByGoal.set(row.goal_id, prev + Number(row.amount));
  }

  return goals.map((g) => {
    const goal: Goal = {
      ...g,
      target_amount: Number(g.target_amount),
    };
    return buildStats(goal, sumByGoal.get(g.id) ?? 0);
  });
}

export async function getGoal(
  goalId: string,
  ledgerId: string
): Promise<GoalStats | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("goals")
    .select(
      "id, ledger_id, name, icon, color, target_amount, deadline, archived, created_at"
    )
    .eq("id", goalId)
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: contribs, error: cErr } = await sb
    .from("goal_contributions")
    .select("amount")
    .eq("goal_id", goalId);
  if (cErr) throw cErr;
  const sum = (contribs ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const goal: Goal = { ...data, target_amount: Number(data.target_amount) };
  return buildStats(goal, sum);
}

export async function listContributions(
  goalId: string,
  limit = 50
): Promise<GoalContribution[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("goal_contributions")
    .select("id, goal_id, user_id, amount, note, occurred_at, created_at")
    .eq("goal_id", goalId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    ...c,
    amount: Number(c.amount),
  }));
}

export async function createGoal(input: {
  ledgerId: string;
  name: string;
  icon?: string;
  color?: string;
  targetAmount: number;
  deadline?: string | null;
}): Promise<Goal> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("goals")
    .insert({
      ledger_id: input.ledgerId,
      name: input.name,
      icon: input.icon ?? "🎯",
      color: input.color ?? "#10b981",
      target_amount: input.targetAmount,
      deadline: input.deadline ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, target_amount: Number(data.target_amount) } as Goal;
}

export async function updateGoal(
  goalId: string,
  ledgerId: string,
  patch: Partial<{
    name: string;
    icon: string | null;
    color: string | null;
    targetAmount: number;
    deadline: string | null;
    archived: boolean;
  }>
): Promise<Goal> {
  const sb = getServerSupabase();
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.icon !== undefined) update.icon = patch.icon;
  if (patch.color !== undefined) update.color = patch.color;
  if (patch.targetAmount !== undefined) update.target_amount = patch.targetAmount;
  if (patch.deadline !== undefined) update.deadline = patch.deadline;
  if (patch.archived !== undefined) update.archived = patch.archived;

  const { data, error } = await sb
    .from("goals")
    .update(update)
    .eq("id", goalId)
    .eq("ledger_id", ledgerId)
    .select()
    .single();
  if (error) throw error;
  return { ...data, target_amount: Number(data.target_amount) } as Goal;
}

/**
 * Delete a goal. Contributions cascade via FK so they vanish too — this
 * is intentional, "I gave up on this goal" should clear the slate. Use
 * archive instead to preserve history.
 */
export async function deleteGoal(goalId: string, ledgerId: string): Promise<void> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("ledger_id", ledgerId);
  if (error) throw error;
}

export async function addContribution(input: {
  goalId: string;
  userId: string;
  amount: number;
  note?: string | null;
  occurredAt?: string;
}): Promise<GoalContribution> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("goal_contributions")
    .insert({
      goal_id: input.goalId,
      user_id: input.userId,
      amount: input.amount,
      note: input.note ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return { ...data, amount: Number(data.amount) } as GoalContribution;
}

export async function deleteContribution(
  contributionId: string,
  ledgerId: string
): Promise<void> {
  const sb = getServerSupabase();
  // Defense-in-depth: ensure the contribution belongs to a goal in the
  // claimed ledger before deleting. The two-step query is cheap.
  const { data: c } = await sb
    .from("goal_contributions")
    .select("goal_id, goals!inner(ledger_id)")
    .eq("id", contributionId)
    .maybeSingle();
  // PostgREST returns the joined relation as either an object or array
  // depending on the row count; handle both shapes defensively.
  const goals = (c as { goals?: { ledger_id: string } | { ledger_id: string }[] } | null)?.goals;
  const ownerLedger = Array.isArray(goals) ? goals[0]?.ledger_id : goals?.ledger_id;
  if (!c || ownerLedger !== ledgerId) {
    throw new Error("Contribution not found in this ledger");
  }

  const { error } = await sb
    .from("goal_contributions")
    .delete()
    .eq("id", contributionId);
  if (error) throw error;
}
