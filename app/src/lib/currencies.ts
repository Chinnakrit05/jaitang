/**
 * Currencies the app supports for foreign-currency trips. The list is
 * deliberately kept short — too many options is overwhelming, and these
 * 32 cover every realistic Thai-traveller destination.
 *
 * Order in `ALL_CURRENCIES` matters for the UI dropdown:
 * - First 10 = "pinned" popular Thai destinations
 * - Rest 22 = alphabetical fallback
 */

export type CurrencyInfo = {
  code: string; // ISO 4217
  name: string;
  flag: string; // emoji
  symbol: string;
};

const PINNED: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$" },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", symbol: "¥" },
  { code: "KRW", name: "South Korean Won", flag: "🇰🇷", symbol: "₩" },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰", symbol: "HK$" },
  { code: "TWD", name: "New Taiwan Dollar", flag: "🇹🇼", symbol: "NT$" },
  { code: "MYR", name: "Malaysian Ringgit", flag: "🇲🇾", symbol: "RM" },
  { code: "VND", name: "Vietnamese Dong", flag: "🇻🇳", symbol: "₫" },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", symbol: "¥" },
  { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€" },
];

const REST: CurrencyInfo[] = [
  { code: "AUD", name: "Australian Dollar", flag: "🇦🇺", symbol: "A$" },
  { code: "BGN", name: "Bulgarian Lev", flag: "🇧🇬", symbol: "лв" },
  { code: "BRL", name: "Brazilian Real", flag: "🇧🇷", symbol: "R$" },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", symbol: "CHF" },
  { code: "CZK", name: "Czech Koruna", flag: "🇨🇿", symbol: "Kč" },
  { code: "DKK", name: "Danish Krone", flag: "🇩🇰", symbol: "kr" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", symbol: "£" },
  { code: "HUF", name: "Hungarian Forint", flag: "🇭🇺", symbol: "Ft" },
  { code: "IDR", name: "Indonesian Rupiah", flag: "🇮🇩", symbol: "Rp" },
  { code: "ILS", name: "Israeli Shekel", flag: "🇮🇱", symbol: "₪" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳", symbol: "₹" },
  { code: "ISK", name: "Icelandic Krona", flag: "🇮🇸", symbol: "kr" },
  { code: "MXN", name: "Mexican Peso", flag: "🇲🇽", symbol: "$" },
  { code: "NOK", name: "Norwegian Krone", flag: "🇳🇴", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿", symbol: "NZ$" },
  { code: "PHP", name: "Philippine Peso", flag: "🇵🇭", symbol: "₱" },
  { code: "PLN", name: "Polish Zloty", flag: "🇵🇱", symbol: "zł" },
  { code: "RON", name: "Romanian Leu", flag: "🇷🇴", symbol: "lei" },
  { code: "SEK", name: "Swedish Krona", flag: "🇸🇪", symbol: "kr" },
  { code: "THB", name: "Thai Baht", flag: "🇹🇭", symbol: "฿" },
  { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", symbol: "₺" },
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦", symbol: "R" },
].sort((a, b) => a.code.localeCompare(b.code));

/**
 * All supported currencies — pinned first, then alphabetical. The dropdown
 * inserts a divider between the two groups; consumers should treat the
 * first 10 entries as the pinned set.
 */
export const ALL_CURRENCIES: CurrencyInfo[] = [...PINNED, ...REST];
export const PINNED_COUNT = PINNED.length;

export const SUPPORTED_CODES: ReadonlySet<string> = new Set(
  ALL_CURRENCIES.map((c) => c.code)
);

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return ALL_CURRENCIES.find((c) => c.code === code);
}

/**
 * Frankfurter (the primary FX source) covers ~30 majors; Taiwan Dollar
 * and Vietnamese Dong are common Thai-tourist destinations that aren't
 * in its set. The fx fetcher falls back to exchangerate.host for these.
 */
export const FRANKFURTER_UNSUPPORTED: ReadonlySet<string> = new Set(["TWD", "VND"]);
