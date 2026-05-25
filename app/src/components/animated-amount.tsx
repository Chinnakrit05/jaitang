"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Animated currency display — tweens from 0 to `value` with an ease-out
 * cubic curve over `duration` ms on mount, then snaps to the final
 * formatted string. Used by the hero card so the big balance number
 * "rolls in" instead of popping.
 *
 * The formatter is built once per (currency, locale) via `useMemo`, so
 * the per-frame cost is just a `.format(round)` call. The display value
 * rounds to integer so the rolling number doesn't flash decimals.
 *
 * Respects `prefers-reduced-motion` — if set, renders the final value
 * immediately with no tween.
 */
export function AnimatedAmount({
  value,
  currency,
  fmtLocale,
  duration = 800,
  prefix = "",
}: {
  value: number;
  currency: string;
  fmtLocale: string;
  duration?: number;
  /** String prepended to the formatted number — e.g. "−" for negative
   *  balances. Pulled outside the formatter so the count-up still
   *  reads as "negative" while tweening through 0. */
  prefix?: string;
}) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(fmtLocale, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [currency, fmtLocale]
  );
  const target = Math.abs(value);
  // Initial state is 0 so the SSR HTML matches the first client render
  // (no hydration mismatch). The effect below tweens up to `target`.
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Reduced-motion path: schedule the snap-to-target inside RAF so the
    // setState isn't synchronous within the effect body (the lint flags
    // synchronous setState as it cascades renders).
    if (reduced || duration <= 0) {
      const raf = requestAnimationFrame(() => {
        setDisplay(target);
        fromRef.current = target;
      });
      return () => cancelAnimationFrame(raf);
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return (
    <>
      {prefix}
      {formatter.format(Math.round(display))}
    </>
  );
}
