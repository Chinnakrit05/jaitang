import { FRANKFURTER_UNSUPPORTED, SUPPORTED_CODES } from "@/lib/currencies";

/**
 * Fetch a single FX rate (`from → to`) from a free public API.
 *
 * Two-source fallback chain:
 *   1) Frankfurter.dev — ECB-backed, free, no key, ~30 currencies
 *   2) exchangerate.host — covers TWD, VND, and acts as fallback if
 *      Frankfurter is unreachable
 *
 * Cached in-process for 24h. Rates from these APIs update daily, so a
 * 24h TTL keeps the form snappy without pretending to be a real-time
 * trading platform. The cache lives per Node process; serverless
 * instances will warm independently — fine for our submit-time call rate.
 */

const CACHE_TTL_MS = 24 * 3600 * 1000;

type CacheEntry = { rate: number; expires: number };
const memCache = new Map<string, CacheEntry>();

async function fetchFromFrankfurter(from: string, to: string): Promise<number> {
  const url = `https://api.frankfurter.dev/latest?from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.[to];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Frankfurter returned no rate for ${from}→${to}`);
  }
  return rate;
}

async function fetchFromExchangerateHost(
  from: string,
  to: string
): Promise<number> {
  const url = `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`exchangerate.host HTTP ${res.status}`);
  const data = (await res.json()) as { result?: number; success?: boolean };
  const rate = data.result;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`exchangerate.host returned no rate for ${from}→${to}`);
  }
  return rate;
}

/**
 * Public entry point. Throws a friendly error if BOTH sources fail —
 * the caller (server action) should surface it to the user with an
 * "enter rate manually" fallback path.
 */
export async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  if (!SUPPORTED_CODES.has(from) || !SUPPORTED_CODES.has(to)) {
    throw new Error(`Unsupported currency pair: ${from}→${to}`);
  }

  const cacheKey = `${from}-${to}`;
  const now = Date.now();
  const cached = memCache.get(cacheKey);
  if (cached && cached.expires > now) return cached.rate;

  // For TWD / VND go straight to exchangerate.host — Frankfurter would
  // 404. For everything else try Frankfurter first; fall back on
  // failure (network, ECB outage, etc).
  const skipFrankfurter =
    FRANKFURTER_UNSUPPORTED.has(from) || FRANKFURTER_UNSUPPORTED.has(to);

  let rate: number;
  if (!skipFrankfurter) {
    try {
      rate = await fetchFromFrankfurter(from, to);
    } catch {
      rate = await fetchFromExchangerateHost(from, to);
    }
  } else {
    rate = await fetchFromExchangerateHost(from, to);
  }

  memCache.set(cacheKey, { rate, expires: now + CACHE_TTL_MS });
  return rate;
}

/** For tests — clear the in-process FX cache between cases. */
export function _resetFxCache() {
  memCache.clear();
}

/**
 * Convert an amount from `from` to `to` using the cached rate. Convenience
 * wrapper for callers that don't need to display the rate separately.
 */
export async function convertAmount(
  amount: number,
  from: string,
  to: string
): Promise<{ converted: number; rate: number }> {
  const rate = await fetchFxRate(from, to);
  return { converted: amount * rate, rate };
}
