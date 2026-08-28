import { EMOJI_ASSETS } from "./emoji-assets";

const ASSET_SET = new Set<string>(EMOJI_ASSETS);

/**
 * The OpenMoji drawing for an emoji, or null if we don't ship one.
 *
 * Code points in lowercase hex joined by "-", with U+FE0F dropped — that
 * selector only asks a font for the colour form, and stored data has it
 * inconsistently ("🏷️" and "🏷" are one pick to whoever made it).
 *
 * Must stay in step with assetName() in scripts/build-emoji-assets.mjs,
 * which names the files this looks up.
 */
export function emojiAssetName(value: string): string | null {
  const name = [...value]
    .map((ch) => ch.codePointAt(0) ?? 0)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join("-");
  return ASSET_SET.has(name) ? name : null;
}

export function emojiAssetUrl(name: string): string {
  return `/emoji/${name}.svg`;
}
