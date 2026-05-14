"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { ICON_STYLES, type IconStyle } from "./icon-names";

const STORAGE_KEY = "jt-icon-style";
const DEFAULT_STYLE: IconStyle = "sticker";

const Ctx = createContext<{
  style: IconStyle;
  setStyle: (s: IconStyle) => void;
}>({
  style: DEFAULT_STYLE,
  setStyle: () => {},
});

/**
 * Provider for the active JtIcon style. Mounted near the root so every
 * `<JtIcon>` re-renders when the user picks a different icon set.
 *
 * Persistence is intentionally client-only via localStorage: SSR always
 * renders the default style, then a tiny `useEffect` rehydrates with the
 * user's pick after mount. The icons themselves don't shift layout when
 * the sprite swaps (same viewBox + size props), so the rehydration flash
 * is just a visual style change rather than a reflow.
 */
export function IconStyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<IconStyle>(DEFAULT_STYLE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && (ICON_STYLES as readonly string[]).includes(stored)) {
        setStyleState(stored as IconStyle);
      }
    } catch {
      // ignore — fall through to default
    }
  }, []);

  function setStyle(next: IconStyle) {
    setStyleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — localStorage might be blocked
    }
  }

  return <Ctx.Provider value={{ style, setStyle }}>{children}</Ctx.Provider>;
}

export function useIconStyle(): IconStyle {
  return useContext(Ctx).style;
}

export function useSetIconStyle(): (s: IconStyle) => void {
  return useContext(Ctx).setStyle;
}
