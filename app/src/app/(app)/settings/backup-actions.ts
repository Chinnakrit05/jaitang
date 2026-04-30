"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { restoreBackup, type RestoreSummary } from "@/lib/backup";

export async function restoreBackupAction(
  formData: FormData
): Promise<{ ok: true; summary: RestoreSummary } | { ok: false; error: string }> {
  const { userId } = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ไม่มีไฟล์ / no file" };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { ok: false, error: "ไฟล์ใหญ่เกิน 50 MB" };
  }
  let payload: unknown;
  try {
    const text = await file.text();
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: "ไฟล์ไม่ใช่ JSON ที่ถูกต้อง" };
  }
  try {
    const summary = await restoreBackup(payload, userId);
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidatePath("/categories");
    revalidatePath("/budgets");
    revalidatePath("/recurring");
    revalidatePath("/balances");
    revalidatePath("/ledgers");
    return { ok: true, summary };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Restore failed",
    };
  }
}
