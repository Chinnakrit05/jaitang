"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isNavbarPeriod, NAVBAR_PERIOD_COOKIE } from "@/lib/period";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setNavbarPeriodAction(period: string) {
  if (!isNavbarPeriod(period)) {
    return { ok: false as const, error: "Invalid period" };
  }
  const store = await cookies();
  store.set(NAVBAR_PERIOD_COOKIE, period, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
