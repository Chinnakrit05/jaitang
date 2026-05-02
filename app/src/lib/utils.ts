import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_LOCALE: Record<string, string> = {
  THB: "th-TH",
  USD: "en-US",
  EUR: "en-EU",
  GBP: "en-GB",
  JPY: "ja-JP",
};

/**
 * Format a money amount. Defaults to THB / th-TH for backward compatibility.
 * Accepts an explicit locale to override the per-currency default.
 */
export function formatCurrency(value: number, currency = "THB", locale?: string) {
  const fmtLocale = locale ?? CURRENCY_LOCALE[currency] ?? "en-US";
  return new Intl.NumberFormat(fmtLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** @deprecated kept for backward compat — prefer formatCurrency. */
export function formatTHB(value: number) {
  return formatCurrency(value, "THB");
}

export function formatDate(date: Date | string, locale = "th-TH") {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** @deprecated kept for backward compat — prefer formatDate. */
export function formatDateTH(date: Date | string) {
  return formatDate(date, "th-TH");
}

/**
 * Format an ISO datetime string for an `<input type="datetime-local">`.
 * Returns `YYYY-MM-DDTHH:MM` in the **runtime's** local timezone.
 *
 * IMPORTANT: only call this on the client. Server-side it formats with the
 * server's TZ (UTC on Vercel), and the browser would display that string
 * verbatim as if it were the user's local time — producing an off-by-N-hours
 * default. Components should set the input's value via `useEffect` + ref.
 */
export function toLocalDateTimeInput(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * Return the calendar day (`YYYY-MM-DD`) that an ISO instant falls on,
 * relative to the given timezone. Uses Intl with `en-CA` because that
 * locale produces ISO-shaped dates natively.
 *
 * The `tz` argument exists so server code can compute "May 1 in Bangkok"
 * even though the runtime is UTC. Pass `undefined` (or omit) on the client
 * to use the browser's TZ — convenient for the transaction list grouping.
 */
export function dayKeyInTz(iso: string | Date, tz?: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Like `dayKeyInTz` but returns the year/month parts the row falls on in
 * the given TZ. Used by the import wizard's "rows per month" summary so
 * that "1 พ.ค. 03:00 Bangkok" doesn't split off into an April bucket
 * (which is what `Date.getUTCMonth()` would produce).
 */
export function yearMonthInTz(
  iso: string | Date,
  tz?: string
): { year: number; month: number } {
  const ymd = dayKeyInTz(iso, tz);
  const [y, m] = ymd.split("-").map(Number);
  return { year: y, month: m };
}
