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
import { SUPPORTED_CODES } from "@/lib/currencies";

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
  currency: z
    .string()
    .min(3)
    .max(3)
    .refine((c) => SUPPORTED_CODES.has(c), "Unsupported currency")
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
    currency: formData.get("currency") || undefined,
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
    currency: parsed.data.currency ?? null,
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

const UpdateTripSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  currency: z
    .string()
    .min(3)
    .max(3)
    .refine((c) => SUPPORTED_CODES.has(c), "Unsupported currency")
    .optional(),
});

/**
 * Edit a trip's metadata (name / icon / color / currency). Currency
 * change does NOT retro-convert existing transactions — they keep their
 * original `fx_*` snapshot. New rows tagged to this trip pick up the
 * new currency from the form's default. See trip-detail page for the
 * "mixed currencies in one trip" rendering.
 */
export async function updateTripDetailsAction(
  tripId: string,
  formData: FormData
) {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const parsed = UpdateTripSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  await updateTrip(tripId, ledgerId, {
    name: parsed.data.name,
    icon: parsed.data.icon ?? null,
    color: parsed.data.color ?? null,
    currency: parsed.data.currency ?? null,
  });
  refresh();
  return { ok: true as const };
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
