"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/i18n/locales";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) {
    return { ok: false as const, error: "Invalid locale" };
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
