import { ICON_NAMES, JtIcon, type IconName } from "./JtIcon";

const ICON_NAME_SET = new Set<string>(ICON_NAMES);

/**
 * Unicode emoji fallback for places where SVG can't render — most importantly
 * inside `<option>` elements in `<select>` dropdowns, which only accept text.
 * Returns the emoji character that visually maps to the icon name, or the
 * input value as-is if it's already an emoji / unknown string.
 */
const NAME_TO_EMOJI: Partial<Record<IconName, string>> = {
  // Account palette
  "cash-stack": "💵",
  "piggy-bank": "🐷",
  "credit-card": "💳",
  "phone-wallet": "📱",
  "money-bag": "💰",
  "coin-purse": "👛",
  atm: "🏧",
  "gold-coin": "🪙",
  // Trip palette
  airplane: "✈️",
  beach: "🏖️",
  mountain: "🏔️",
  ramen: "🍜",
  party: "🎉",
  backpack: "🎒",
  car: "🚗",
  "cruise-ship": "🛳️",
  camping: "🏕️",
  gift: "🎁",
  // Goal palette
  bullseye: "🎯",
  house: "🏠",
  ring: "💍",
  "graduation-cap": "🎓",
  laptop: "💻",
  "game-controller": "🎮",
  "shopping-cart": "🛒",
  // Category palette
  coffee: "☕",
  pill: "💊",
  books: "📚",
  "trending-up": "📈",
  tag: "🏷️",
  sparkle: "✨",
  sparkles: "✨",
};

export function iconNameToEmoji(value: string | null | undefined): string {
  if (!value) return "";
  return NAME_TO_EMOJI[value as IconName] ?? value;
}

type Props = {
  value: string | null | undefined;
  size?: number;
  fallback?: string; // shown when value is empty
  className?: string;
};

/**
 * Bridge component for the dual-format icon field.
 *
 * `account.icon`, `category.icon`, etc. historically stored an emoji char
 * (e.g. `"💵"`). New picks store a JtIcon name (e.g. `"cash-stack"`).
 * This renders the right thing without forcing a DB migration: if the
 * value matches a known sprite symbol we resolve it via `<JtIcon>`,
 * otherwise we render it inline as text (works for emoji + plain text).
 */
export function EmojiOrIcon({ value, size = 20, fallback, className }: Props) {
  const v = value ?? fallback ?? "";
  if (!v) return null;
  if (ICON_NAME_SET.has(v)) {
    return <JtIcon name={v as IconName} size={size} className={className} />;
  }
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      {v}
    </span>
  );
}
