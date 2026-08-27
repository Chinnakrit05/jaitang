import { describe, expect, it } from "vitest";
import { ICON_NAMES } from "@/components/icons/icon-names";
import { EXTRA_ICON_NAMES } from "@/components/icons/extra-icon-names";
import { iconNameForEmoji, MAPPED_EMOJI_COUNT } from "@/lib/emoji-to-icon";
import { planIconMigration, type IconOwner } from "@/lib/icon-migration";

const DRAWABLE = new Set<string>([...ICON_NAMES, ...EXTRA_ICON_NAMES]);

describe("iconNameForEmoji", () => {
  it("maps an emoji the icon set can draw", () => {
    expect(iconNameForEmoji("🍜")).toBe("ramen");
    expect(iconNameForEmoji("🐱")).toBe("cat");
  });

  it("ignores the colour variation selector, in the value or the table", () => {
    // "🏷️" is stored both with and without U+FE0F depending on where it
    // was typed; both are the same pick to the person who made it.
    expect(iconNameForEmoji("🏷️")).toBe("tag");
    expect(iconNameForEmoji("🏷")).toBe("tag");
  });

  it("leaves an emoji alone when nothing honest matches it", () => {
    // No icon set draws a specific tortoise or an avocado, and inventing
    // a stand-in would change what the user picked.
    expect(iconNameForEmoji("🐢")).toBeNull();
    expect(iconNameForEmoji("🥑")).toBeNull();
  });

  it("does nothing to a value that is already an icon name", () => {
    expect(iconNameForEmoji("ramen")).toBeNull();
  });

  it("handles an empty icon", () => {
    expect(iconNameForEmoji(null)).toBeNull();
    expect(iconNameForEmoji("")).toBeNull();
  });

  it("only ever points at a name some sprite can draw", () => {
    // A typo here would write an icon name nothing renders, and the row
    // would show an empty box with the original emoji already gone.
    for (const emoji of ["🍜", "💰", "🐶", "✈️", "🏠", "💊", "📚", "🎁"]) {
      expect(DRAWABLE.has(iconNameForEmoji(emoji)!)).toBe(true);
    }
  });

  it("covers the emoji the default categories ship with", () => {
    const seeded = ["🍜", "🚗", "🛒", "🎮", "💊", "🏠", "📚", "✨", "💰", "🎁", "🏷️", "📈"];
    for (const emoji of seeded) expect(iconNameForEmoji(emoji)).not.toBeNull();
  });

  it("keeps a table worth having", () => {
    expect(MAPPED_EMOJI_COUNT).toBeGreaterThan(400);
  });
});

describe("planIconMigration", () => {
  const rows: IconOwner[] = [
    { kind: "category", id: "c1", name: "อาหาร", icon: "🍜" },
    { kind: "category", id: "c2", name: "คาเฟ่", icon: "coffee" },
    { kind: "category", id: "c3", name: "เต่า", icon: "🐢" },
    { kind: "account", id: "a1", name: "เงินสด", icon: null },
    { kind: "ledger", id: "l1", name: "บ้าน", icon: "🏠" },
  ];

  it("proposes only the rows an icon can replace", () => {
    expect(planIconMigration(rows)).toEqual([
      { kind: "category", id: "c1", name: "อาหาร", from: "🍜", to: "ramen" },
      { kind: "ledger", id: "l1", name: "บ้าน", from: "🏠", to: "house" },
    ]);
  });

  it("is a no-op the second time", () => {
    const done = planIconMigration(rows).map((c) => ({
      kind: c.kind,
      id: c.id,
      name: c.name,
      icon: c.to as string,
    }));
    expect(planIconMigration(done)).toEqual([]);
  });
});
