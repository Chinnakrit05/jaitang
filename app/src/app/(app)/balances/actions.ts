"use server";

import { revalidatePath } from "next/cache";
import { requireSession, assertWritable } from "@/lib/session";
import { settleBetween } from "@/lib/splits";

export async function settleBetweenAction(opts: {
  debtorId: string;
  payerId: string;
}) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  const count = await settleBetween({
    ledgerId,
    debtorId: opts.debtorId,
    payerId: opts.payerId,
  });
  revalidatePath("/balances");
  revalidatePath("/transactions");
  return { count };
}
