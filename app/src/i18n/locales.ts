export const LOCALES = ["th", "en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";
export const LOCALE_COOKIE = "jt_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  th: "ไทย",
  en: "English",
  zh: "中文",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
