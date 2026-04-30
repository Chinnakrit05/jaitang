/**
 * Map our short app locale ("th" | "en" | "zh" | "ja") to a full Intl BCP-47 tag.
 * Used by formatCurrency / formatDate.
 */
export function intlLocale(appLocale: string): string {
  switch (appLocale) {
    case "en":
      return "en-US";
    case "zh":
      return "zh-CN";
    case "ja":
      return "ja-JP";
    case "th":
    default:
      return "th-TH";
  }
}
