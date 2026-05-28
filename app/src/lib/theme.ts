/**
 * Theme system — runs entirely client-side via localStorage + CSS variables.
 *
 * Three orthogonal axes:
 *   - mode    : light | dark | system   (handled by next-themes via .dark class)
 *   - oled    : boolean                  (only applies when dark; → .oled class)
 *   - accent  : 6 named hues             (→ data-accent attribute)
 *   - season  : 4 seasonal palettes      (→ data-season attribute, overrides accent)
 *
 * When `season === "auto"`, we derive the active palette from today's date.
 * Otherwise the user's pick wins. Setting `season` to "default" disables
 * the override entirely (accent picker takes over).
 */

export const ACCENTS = [
  "cyan",
  "mint",
  "ocean",
  "lavender",
  "coral",
  "rose",
] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "cyan";

export const SEASONS = [
  "default",
  "songkran",
  "loy-krathong",
  "chinese-new-year",
  "christmas",
] as const;
export type Season = (typeof SEASONS)[number];

export const PETS = [
  "shiba",
  "blackcat",
  "husky",
  "pug",
  "whitecat",
] as const;
export type Pet = (typeof PETS)[number];
export const DEFAULT_PET: Pet = "shiba";

export const STORAGE_KEYS = {
  oled: "jt-theme-oled",
  accent: "jt-theme-accent",
  season: "jt-theme-season",
  seasonAuto: "jt-theme-season-auto",
  pet: "jt-theme-pet",
} as const;

export function isAccent(v: unknown): v is Accent {
  return typeof v === "string" && (ACCENTS as readonly string[]).includes(v);
}
export function isSeason(v: unknown): v is Season {
  return typeof v === "string" && (SEASONS as readonly string[]).includes(v);
}
export function isPet(v: unknown): v is Pet {
  return typeof v === "string" && (PETS as readonly string[]).includes(v);
}

/**
 * Pick the seasonal palette for a given date. Order matters — first match
 * wins. Date windows are intentionally permissive (we'd rather show a
 * Songkran theme on April 12 or 16 than be strict and feel broken).
 */
export function autoSeason(now = new Date()): Season {
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();

  // Songkran: April 10-17
  if (m === 4 && d >= 10 && d <= 17) return "songkran";
  // Chinese New Year window: Jan 20 – Feb 20 (lunar, but rough window OK)
  if ((m === 1 && d >= 20) || (m === 2 && d <= 20)) return "chinese-new-year";
  // Loy Krathong full-moon window: Nov 5-20
  if (m === 11 && d >= 5 && d <= 20) return "loy-krathong";
  // Christmas: Dec 18 - Jan 2
  if ((m === 12 && d >= 18) || (m === 1 && d <= 2)) return "christmas";
  return "default";
}

export const ACCENT_LABELS: Record<Accent, { emoji: string; nameKey: string }> = {
  cyan: { emoji: "🔵", nameKey: "theme.accent.cyan" },
  mint: { emoji: "💚", nameKey: "theme.accent.mint" },
  ocean: { emoji: "🌊", nameKey: "theme.accent.ocean" },
  lavender: { emoji: "💜", nameKey: "theme.accent.lavender" },
  coral: { emoji: "🌅", nameKey: "theme.accent.coral" },
  rose: { emoji: "🌹", nameKey: "theme.accent.rose" },
};

export const SEASON_LABELS: Record<Season, { emoji: string; nameKey: string }> = {
  default: { emoji: "—", nameKey: "theme.season.default" },
  songkran: { emoji: "🌊", nameKey: "theme.season.songkran" },
  "loy-krathong": { emoji: "🪔", nameKey: "theme.season.loyKrathong" },
  "chinese-new-year": { emoji: "🧧", nameKey: "theme.season.chineseNewYear" },
  christmas: { emoji: "🎄", nameKey: "theme.season.christmas" },
};

export const PET_LABELS: Record<Pet, { emoji: string; nameKey: string; swatch: string }> = {
  shiba: { emoji: "🐕", nameKey: "theme.pet.shiba", swatch: "#E89A6A" },
  blackcat: { emoji: "🐈‍⬛", nameKey: "theme.pet.blackcat", swatch: "#6B4FBB" },
  husky: { emoji: "🐺", nameKey: "theme.pet.husky", swatch: "#7BA4C9" },
  pug: { emoji: "🐶", nameKey: "theme.pet.pug", swatch: "#8B5A3C" },
  whitecat: { emoji: "🐱", nameKey: "theme.pet.whitecat", swatch: "#E89AAE" },
};
