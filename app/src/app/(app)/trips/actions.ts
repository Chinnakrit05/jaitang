"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertWritable, requireSession } from "@/lib/session";
import {
  setActiveTripCookie,
  clearActiveTripCookie,
} from "@/lib/active-trip";
import {
  createTrip,
  deleteTrip,
  getTrip,
  removeTransactionFromTrip,
  updateTrip,
} from "@/lib/trips";

function refresh() {
  revalidatePath("/trips");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

const CreateTripSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function createTripAction(formData: FormData) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = CreateTripSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const trip = await createTrip({
    ledgerId,
    name: parsed.data.name,
    icon: parsed.data.icon,
    color: parsed.data.color,
    startsAt: parsed.data.startsAt
      ? new Date(parsed.data.startsAt).toISOString()
      : null,
    endsAt: parsed.data.endsAt
      ? new Date(parsed.data.endsAt).toISOString()
      : null,
  });

  // New trip → make it the active one, the whole point of creating it.
  await setActiveTripCookie(trip.id);
  refresh();
  redirect(`/trips/${trip.id}`);
}

export async function setActiveTripAction(tripId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const trip = await getTrip(tripId, ledgerId);
  if (!trip) throw new Error("Trip not found in this ledger");
  if (trip.archived) {
    throw new Error("Cannot activate an archived trip — unarchive it first");
  }

  await setActiveTripCookie(tripId);
  refresh();
}

export async function clearActiveTripAction() {
  await requireSession();
  await clearActiveTripCookie();
  refresh();
}

export async function archiveTripAction(tripId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await updateTrip(tripId, ledgerId, { archived: true });
  // Archived trip can't be active any more. Clear the cookie so the UI
  // doesn't keep highlighting it.
  await clearActiveTripCookie();
  refresh();
}

export async function unarchiveTripAction(tripId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await updateTrip(tripId, ledgerId, { archived: false });
  refresh();
}

export async function deleteTripAction(tripId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await deleteTrip(tripId, ledgerId);
  // Same reason as archive — drop a stale active-trip cookie pointing here.
  await clearActiveTripCookie();
  refresh();
  redirect("/trips");
}

export async function removeTransactionFromTripAction(txId: string) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);
  await removeTransactionFromTrip(txId, ledgerId);
  refresh();
}
