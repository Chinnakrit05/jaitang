"use server";

import { requireSession } from "@/lib/session";
import { fetchFxRate } from "@/lib/fx";
import { SUPPORTED_CODES } from "@/lib/currencies";

/**
 * Server action wrapper around `fetchFxRate` for client-side preview use.
 * The transaction form calls this on amount-input debounce so the user
 * sees an "≈ ฿350" hint before submitting. Cached server-side via
 * `unstable_cache` (24h), so successive calls during typing are cheap.
 */
export async function getFxRateAction(
  from: string,
  to: string
): Promise<{ ok: true; rate: number } | { ok: false; error: string }> {
  // Only logged-in users can hit FX endpoints — keeps random scrapers out.
  await requireSession();

  if (!SUPPORTED_CODES.has(from) || !SUPPORTED_CODES.has(to)) {
    return { ok: false, error: "Unsupported currency" };
  }

  try {
    const rate = await fetchFxRate(from, to);
    return { ok: true, rate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "FX fetch failed" };
  }
}
