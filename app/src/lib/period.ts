import { cookies } from "next/headers";

export type NavbarPeriod = "today" | "week" | "month" | "year";

export const NAVBAR_PERIODS: NavbarPeriod[] = ["today", "week", "month", "year"];
export const DEFAULT_NAVBAR_PERIOD: NavbarPeriod = "today";
export const NAVBAR_PERIOD_COOKIE = "jt_navbar_period";

export function isNavbarPeriod(value: unknown): value is NavbarPeriod {
  return (
    typeof value === "string" &&
    (NAVBAR_PERIODS as readonly string[]).includes(value)
  );
}

/** Resolve [from, toExclusive] for the given period in local time. */
export function periodRange(period: NavbarPeriod, now = new Date()): {
  from: Date;
  to: Date;
} {
  const local = new Date(now);
  local.setHours(0, 0, 0, 0);
  switch (period) {
    case "today": {
      const from = local;
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return { from, to };
    }
    case "week": {
      // Week starts Monday (ISO + Thai convention).
      const from = new Date(local);
      const dow = from.getDay(); // 0 = Sun
      const diff = (dow + 6) % 7; // days since Monday
      from.setDate(from.getDate() - diff);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return { from, to };
    }
    case "month": {
      const from = new Date(local.getFullYear(), local.getMonth(), 1);
      const to = new Date(local.getFullYear(), local.getMonth() + 1, 1);
      return { from, to };
    }
    case "year": {
      const from = new Date(local.getFullYear(), 0, 1);
      const to = new Date(local.getFullYear() + 1, 0, 1);
      return { from, to };
    }
  }
}

export async function getNavbarPeriod(): Promise<NavbarPeriod> {
  const store = await cookies();
  const v = store.get(NAVBAR_PERIOD_COOKIE)?.value;
  return isNavbarPeriod(v) ? v : DEFAULT_NAVBAR_PERIOD;
}
