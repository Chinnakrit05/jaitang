import { EXTRA_ICON_GROUPS } from "./extra-icon-names";
import type { IconName } from "./JtIcon";

/**
 * What the category icon picker offers, grouped the way the emoji tab is.
 *
 * Each group is the shared-137 icons that belong in it, then the
 * vector-only extras from extra-icon-names.ts. Splitting it this way keeps
 * the generated file generated: the extras come straight from the sprite
 * builders, and only the hand-picked shared names live here.
 *
 * A few shared names are deliberately left out because another name in the
 * same group draws the same picture — `wallet-domain` and `coin-purse` are
 * both a wallet, `atm` and `landmark` are both a bank, `home` and `house`
 * are the same house. Two identical tiles in one grid is a picker bug, not
 * a choice.
 */
const SHARED_BY_GROUP: Record<string, IconName[]> = {
  food: ["ramen", "coffee"],
  fruit: [],
  transport: [
    "car",
    "airplane",
    "cruise-ship",
    "trips",
    "camping",
    "mountain",
    "beach",
    "backpack",
  ],
  shopping: ["shopping-cart", "gift", "tag"],
  home: ["house"],
  health: ["pill", "shield-check"],
  tech: ["laptop", "smartphone", "camera", "keyboard", "mic", "volume-2"],
  money: [
    "money-bag",
    "piggy-bank",
    "banknote",
    "credit-card",
    "gold-coin",
    "bitcoin",
    "coin-purse",
    "atm",
    "receipt",
    "budgets",
    "loans",
    "handcoins-domain",
    "trending-up",
    "trending-down",
    "bar-chart-3",
    "balances",
  ],
  fun: ["party", "game-controller", "books", "award"],
  animal: [],
  nature: ["flame", "sun", "moon", "globe"],
  work: [
    "graduation-cap",
    "ledgers",
    "calendar",
    "clock",
    "mail",
    "map",
    "pencil",
    "users",
    "user",
    "bot",
    "building-2",
    "file-text",
  ],
  love: ["sparkle", "sparkles", "ring"],
};

/** Chip labels for the group strip. Emoji here are UI decoration on a
 *  button, not values that get stored. */
const GROUP_LABEL: Record<string, string> = {
  food: "🍜",
  fruit: "🍎",
  transport: "🚕",
  shopping: "🛍️",
  home: "🏠",
  health: "💊",
  tech: "💻",
  money: "💰",
  fun: "🎮",
  animal: "🐶",
  nature: "🌳",
  work: "💼",
  love: "❤️",
};

export type IconPickerGroup = {
  key: string;
  label: string;
  names: IconName[];
};

export const ICON_PICKER_GROUPS: IconPickerGroup[] = EXTRA_ICON_GROUPS.map(
  (g) => ({
    key: g.key,
    label: GROUP_LABEL[g.key] ?? "✨",
    names: [...(SHARED_BY_GROUP[g.key] ?? []), ...g.names] as IconName[],
  })
);

/** Flat set for "is this stored value one the picker offers?" checks. */
export const PICKER_ICON_NAMES = new Set<string>(
  ICON_PICKER_GROUPS.flatMap((g) => g.names)
);
