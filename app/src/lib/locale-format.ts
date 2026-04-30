/**
 * Map our short app locale ("th" | "en") to a full Intl BCP-47 tag.
 * Used by formatCurrency / formatDate.
 */
export function intlLocale(appLocale: string): string {
  return appLocale === "en" ? "en-US" : "th-TH";
}
