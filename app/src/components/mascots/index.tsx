"use client";

import { useEffect, useState } from "react";
import { isPet, type Pet } from "@/lib/theme";
import { ShibaMascot } from "./shiba-mascot";
import { BlackCatMascot } from "./blackcat-mascot";
import { HuskyMascot } from "./husky-mascot";
import { PugMascot } from "./pug-mascot";
import { WhiteCatMascot } from "./whitecat-mascot";

/**
 * Palette-aware mascot. Reads `data-pet` from <html> and picks the matching
 * SVG. The boot script in <head> sets that attribute before paint, so the
 * mascot's first render usually matches the active palette — but on first
 * visit (no localStorage yet) the SSR shape defaults to Shiba.
 *
 * MutationObserver lets in-tab theme changes from /settings refresh the
 * mascot live without a page reload.
 */
export function Mascot({
  size = 94,
  idPrefix,
}: {
  size?: number;
  idPrefix?: string;
}) {
  const [pet, setPet] = useState<Pet>("shiba");

  useEffect(() => {
    const sync = () => {
      const v = document.documentElement.getAttribute("data-pet");
      setPet(isPet(v) ? v : "shiba");
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-pet"],
    });
    return () => obs.disconnect();
  }, []);

  switch (pet) {
    case "blackcat":
      return <BlackCatMascot size={size} idPrefix={idPrefix ?? "blackcat"} />;
    case "husky":
      return <HuskyMascot size={size} idPrefix={idPrefix ?? "husky"} />;
    case "pug":
      return <PugMascot size={size} idPrefix={idPrefix ?? "pug"} />;
    case "whitecat":
      return <WhiteCatMascot size={size} idPrefix={idPrefix ?? "whitecat"} />;
    case "shiba":
    default:
      return <ShibaMascot size={size} idPrefix={idPrefix ?? "shiba"} />;
  }
}

export { ShibaMascot };
export { BlackCatMascot } from "./blackcat-mascot";
export { HuskyMascot } from "./husky-mascot";
export { PugMascot } from "./pug-mascot";
export { WhiteCatMascot } from "./whitecat-mascot";
