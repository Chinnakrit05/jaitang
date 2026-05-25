import { ShibaMascot } from "./shiba-mascot";

/**
 * Palette-aware mascot. Mirrors `jaitang-mobile/components/Mascot.tsx`.
 *
 * The mobile app switches between Shiba / CalicoCat / Penguin / BlackCat
 * / Samoyed based on the active palette. The web app only ships the
 * Shiba for now — extra mascots can be ported one at a time when their
 * palettes land in the web theme system.
 */
export function Mascot({
  size = 94,
  idPrefix,
}: {
  size?: number;
  idPrefix?: string;
}) {
  return <ShibaMascot size={size} idPrefix={idPrefix} />;
}

export { ShibaMascot };
