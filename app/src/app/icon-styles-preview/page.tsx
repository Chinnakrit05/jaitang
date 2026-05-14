"use client";

import { JtIcon, ICON_STYLES, ICON_STYLE_LABELS, useIconStyle, useSetIconStyle, type IconName } from "@/components/icons";

const ROW_ICONS: IconName[] = [
  "home", "budgets", "accounts", "trips", "goals", "categories", "settings",
  "plus-fab", "pencil", "trash2", "check", "search", "camera", "share",
  "trending-up", "bell", "sparkles", "flame", "users",
  "banknote", "credit-card", "smartphone",
  "cash-stack", "piggy-bank", "money-bag",
  "airplane", "ramen", "party", "car", "gift",
  "bullseye", "house", "ring", "graduation-cap", "laptop", "game-controller", "shopping-cart",
  "coffee", "pill", "books", "tag",
];

export default function IconStylesPreview() {
  const active = useIconStyle();
  const setStyle = useSetIconStyle();
  return (
    <div className="min-h-screen p-6 sm:p-10 space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold">Icon style — side-by-side</h1>
        <p className="text-sm text-(--muted) mt-1">
          Same 40+ icons rendered through each sprite. Pick one to set the active style for the rest of the app.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {ICON_STYLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStyle(s)}
            className={`px-3 py-1.5 rounded-full border text-sm transition ${
              active === s
                ? "border-(--foreground) bg-(--background)"
                : "border-(--border) bg-(--card) hover:bg-(--background) text-(--muted)"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <JtIcon name="home" size={18} styleOverride={s} />
              {ICON_STYLE_LABELS[s]}
              {active === s && " ✓"}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3">
        {ICON_STYLES.map((s) => (
          <section
            key={s}
            className="rounded-xl border border-(--border) bg-(--card) p-3 space-y-2"
          >
            <h2 className="text-sm font-semibold text-center">
              {ICON_STYLE_LABELS[s]}
            </h2>
            <div className="grid grid-cols-4 gap-1">
              {ROW_ICONS.map((n) => (
                <div
                  key={n}
                  className="aspect-square inline-flex items-center justify-center rounded bg-(--background)"
                >
                  <JtIcon name={n} size={26} styleOverride={s} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
