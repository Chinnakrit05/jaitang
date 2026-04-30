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
