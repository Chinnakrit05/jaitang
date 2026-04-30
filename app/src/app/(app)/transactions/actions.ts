"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/transactions";
import { equalSplit, replaceSplits } from "@/lib/splits";
import { sendToUsers } from "@/lib/push";
import { listMembers } from "@/lib/members";
import { getServerSupabase } from "@/lib/supabase/server";
import { formatTHB } from "@/lib/utils";

const TxSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("จำนวนต้องมากกว่า 0").max(1e12),
  categoryId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).optional(),
  occurredAt: z.string().min(1),
});

function refreshAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/balances");
}

/**
 * Read split-with user ids from formData. Form sends `splitWith` as a comma-separated
 * list of user ids when the "หารบิล" toggle is on. The payer is included in that list
 * (they carry their own share implicitly), so we strip them before persisting splits —
 * we only store rows for users who OWE the payer.
 */
function readSplitWith(formData: FormData, payerId: string): string[] | null {
  const raw = formData.get("splitWith");
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return null;
  return ids.filter((id) => id !== payerId);
}

export async function createTransactionAction(formData: FormData) {
  const { userId, ledgerId } = await requireSession();

  const parsed = TxSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || null,
    note: formData.get("note") || undefined,
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tx = await createTransaction({
    ledgerId,
    userId,
    categoryId: parsed.data.categoryId ?? null,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    note: parsed.data.note,
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
  });

  // Splits only make sense for expenses
  let splitOthers: string[] = [];
  if (parsed.data.kind === "expense") {
    const otherIds = readSplitWith(formData, userId);
    if (otherIds && otherIds.length > 0) {
      // Equal split among (payer + others), then store only the others' shares
      const allIds = [userId, ...otherIds];
      const shares = equalSplit(parsed.data.amount, allIds);
      const splits = otherIds
        .map((id) => ({ userId: id, amount: shares.get(id) ?? 0 }))
        .filter((s) => s.amount > 0);
      await replaceSplits(tx.id, splits);
      splitOthers = otherIds;
    }
  }

  // Notify other ledger members in shared ledgers (best-effort, non-blocking on errors)
  try {
    const sb = getServerSupabase();
    const { data: ledger } = await sb
      .from("ledgers")
      .select("name, is_personal")
      .eq("id", ledgerId)
      .single();
    if (ledger && !ledger.is_personal) {
      const members = await listMembers(ledgerId);
      const recipients = members
        .map((m) => m.user_id)
        .filter((id) => id !== userId);
      if (recipients.length > 0) {
        const sign = parsed.data.kind === "income" ? "+" : "−";
        await sendToUsers(recipients, {
          title: `${ledger.name} — รายการใหม่`,
          body:
            splitOthers.length > 0
              ? `${sign}${formatTHB(parsed.data.amount)} • หาร ${splitOthers.length + 1} คน`
              : `${sign}${formatTHB(parsed.data.amount)}${
                  parsed.data.note ? ` • ${parsed.data.note}` : ""
                }`,
          url: "/transactions",
          tag: `tx-${tx.id}`,
        });
      }
    }
  } catch (err) {
    console.error("[push] notify on create failed:", err);
  }

  refreshAll();
  redirect("/transactions");
}

export async function updateTransactionAction(id: string, formData: FormData) {
  const { userId } = await requireSession();

  const parsed = TxSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId") || null,
    note: formData.get("note") || undefined,
    occurredAt: formData.get("occurredAt"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await updateTransaction(id, {
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    categoryId: parsed.data.categoryId ?? null,
    note: parsed.data.note ?? null,
    occurredAt: new Date(parsed.data.occurredAt).toISOString(),
  });

  // Re-write splits to match the (possibly new) amount + member set
  if (parsed.data.kind === "expense") {
    const otherIds = readSplitWith(formData, userId);
    if (otherIds && otherIds.length > 0) {
      const allIds = [userId, ...otherIds];
      const shares = equalSplit(parsed.data.amount, allIds);
      const splits = otherIds
        .map((memberId) => ({ userId: memberId, amount: shares.get(memberId) ?? 0 }))
        .filter((s) => s.amount > 0);
      await replaceSplits(id, splits);
    } else {
      await replaceSplits(id, []);
    }
  } else {
    await replaceSplits(id, []);
  }

  refreshAll();
  redirect("/transactions");
}

export async function deleteTransactionAction(id: string) {
  await requireSession();
  await deleteTransaction(id);
  refreshAll();
}
