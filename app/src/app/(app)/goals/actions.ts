"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertWritable, requireSession } from "@/lib/session";
import {
  addContribution,
  createGoal,
  deleteContribution,
  deleteGoal,
  updateGoal,
} from "@/lib/goals";

function refresh() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

const CreateGoalSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  targetAmount: z.coerce.number().positive().max(1e12),
  // Deadline accepts either UTC ISO (preferred — client converts) or
  // a TZ-naive datetime-local string. We normalise to ISO before save.
  deadline: z.string().optional(),
});

export async function createGoalAction(formData: FormData) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = CreateGoalSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    targetAmount: formData.get("targetAmount"),
    deadline: formData.get("deadline") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const goal = await createGoal({
    ledgerId,
    name: parsed.data.name,
    icon: parsed.data.icon,
    color: parsed.data.color,
    targetAmount: parsed.data.targetAmount,
    deadline: parsed.data.deadline
      ? new Date(parsed.data.deadline).toISOString()
      : null,
  });
  refresh();
  redirect(`/goals/${goal.id}`);
}

const UpdateGoalSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  targetAmount: z.coerce.number().positive().max(1e12),
  deadline: z.string().optional(),
});

export async function updateGoalDetailsAction(
  goalId: string,
  formData: FormData
) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = UpdateGoalSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    targetAmount: formData.get("targetAmount"),
    deadline: formData.get("deadline") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await updateGoal(goalId, ledgerId, {
    name: parsed.data.name,
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
    targetAmount: parsed.data.targetAmount,
    deadline: parsed.data.deadline
      ? new Date(parsed.data.deadline).toISOString()
      : null,
  });
  refresh();
  return { ok: true as const };
}

export async function archiveGoalAction(goalId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await updateGoal(goalId, ledgerId, { archived: true });
  refresh();
}

export async function unarchiveGoalAction(goalId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await updateGoal(goalId, ledgerId, { archived: false });
  refresh();
}

export async function deleteGoalAction(goalId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await deleteGoal(goalId, ledgerId);
  refresh();
  redirect("/goals");
}

const ContributionSchema = z.object({
  amount: z.coerce.number().positive().max(1e12),
  note: z.string().max(500).optional(),
});

export async function addContributionAction(
  goalId: string,
  formData: FormData
) {
  const { userId, role } = await requireSession();
  assertWritable(role);

  const parsed = ContributionSchema.safeParse({
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await addContribution({
    goalId,
    userId,
    amount: parsed.data.amount,
    note: parsed.data.note ?? null,
  });
  refresh();
  return { ok: true as const };
}

export async function deleteContributionAction(contributionId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await deleteContribution(contributionId, ledgerId);
  refresh();
}
