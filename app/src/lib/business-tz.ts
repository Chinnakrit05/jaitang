/**
 * The "calendar" timezone the server reasons about when bucketing rows
 * into days, months, or arbitrary ranges. The app is Thai-first, currency
 * THB, and Bangkok has no DST, so a fixed +7 offset works year-round.
 *
 * Move this to a per-user / per-ledger setting if we ever ship outside
 * of Thailand.
 */
export const BUSINESS_TZ = "Asia/Bangkok";
export const BUSINESS_TZ_OFFSET_HOURS = 7;

/**
 * Return a Date that, when read with .getUTCFullYear / .getUTCMonth /
 * .getUTCDate, yields the calendar parts of *now* in BUSINESS_TZ rather
 * than UTC. This is a math trick, not a real timezone conversion — the
 * resulting Date is misleading if you call it directly. Only use it to
 * pull out year/month/day fields, then throw it away.
 */
export function nowInBusinessTz(now: Date = new Date()): Date {
  return new Date(now.getTime() + BUSINESS_TZ_OFFSET_HOURS * 3600_000);
}

/**
 * UTC instant corresponding to midnight on (year, month, day) in
 * BUSINESS_TZ. Months are 0-indexed (matches Date.UTC).
 */
export function businessTzMidnightUtc(
  year: number,
  monthIndex: number,
  day: number
): Date {
  return new Date(
    Date.UTC(year, monthIndex, day, -BUSINESS_TZ_OFFSET_HOURS, 0, 0)
  );
}
