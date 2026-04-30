"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { saveSubscription, deleteSubscription } from "@/lib/push";

export async function subscribePushAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const { userId } = await requireSession();
  await saveSubscription({
    userId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    userAgent: input.userAgent,
  });
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function unsubscribePushAction(endpoint: string) {
  const { userId } = await requireSession();
  await deleteSubscription({ userId, endpoint });
  revalidatePath("/settings");
}
