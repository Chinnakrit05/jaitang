"use client";

import { useEffect, useState } from "react";
import { JtIcon } from "@/components/icons";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Monitor } from "lucide-react";
import {
  ACCENTS,
  ACCENT_LABELS,
  DEFAULT_ACCENT,
  SEASONS,
  SEASON_LABELS,
  STORAGE_KEYS,
  autoSeason,
  isAccent,
  isSeason,
  type Accent,
  type Season,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Live preview swatch — shows what the accent button will look like by
 * inlining the same color from data-accent CSS rules. We hard-code the
 * hex here so the swatch renders correctly regardless of which accent
 * is currently active on <html>.
 */
const ACCENT_SWATCHES: Record<Accent, string> = {
  cyan: "#4cc9f0",
  mint: "#10b981",
  ocean: "#3b82f6",
  lavender: "#a855f7",
  coral: "#f97316",
  rose: "#ec4899",
};

const SEASON_SWATCHES: Record<Season, string> = {
  default: "transparent",
  songkran: "#06b6d4",
  "loy-krathong": "#eab308",
  "chinese-new-year": "#dc2626",
  christmas: "#16a34a",
};

export function ThemeControls() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [oled, setOled] = useState(false);
  const [accent, setAccent] = useState<Accent>(DEFAULT_ACCENT);
  const [season, setSeason] = useState<Season>("default");
  const [seasonAuto, setSeasonAuto] = useState(false);

  // Hydrate from localStorage once after mount. SSR can't read it, and the
  // boot script in <head> already applied the right CSS — we're just syncing
  // React state with the DOM attributes that script set.
  useEffect(() => {
    setMounted(true);
    setOled(localStorage.getItem(STORAGE_KEYS.oled) === "true");
    const a = localStorage.getItem(STORAGE_KEYS.accent);
    if (isAccent(a)) setAccent(a);
    const s = localStorage.getItem(STORAGE_KEYS.season);
    if (isSeason(s)) setSeason(s);
    setSeasonAuto(localStorage.getItem(STORAGE_KEYS.seasonAuto) === "true");
  }, []);

  // Apply each change to <html> + persist. We intentionally DON'T debounce —
  // the user wants to see the picked color flash on the page so they can
  // decide whether they like it.
  function applyOled(next: boolean) {
    setOled(next);
    localStorage.setItem(STORAGE_KEYS.oled, String(next));
    document.documentElement.classList.toggle("oled", next);
  }
  function applyAccent(next: Accent) {
    setAccent(next);
    localStorage.setItem(STORAGE_KEYS.accent, next);
    document.documentElement.setAttribute("data-accent", next);
  }
  function applySeason(next: Season) {
    setSeason(next);
    localStorage.setItem(STORAGE_KEYS.season, next);
    if (next === "default") {
      document.documentElement.removeAttribute("data-season");
    } else {
      document.documentElement.setAttribute("data-season", next);
    }
  }
  function applySeasonAuto(next: boolean) {
    setSeasonAuto(next);
    localStorage.setItem(STORAGE_KEYS.seasonAuto, String(next));
    if (next) {
      const auto = autoSeason();
      // Preserve the user's manual pick in `season` state but apply the
      // computed one to the DOM. Toggling auto OFF restores their pick.
      if (auto === "default") {
        document.documentElement.removeAttribute("data-season");
      } else {
        document.documentElement.setAttribute("data-season", auto);
      }
    } else {
      // Re-apply the user's manual pick
      applySeason(season);
    }
  }

  if (!mounted) {
    // Prevent hydration mismatch warnings — render placeholders
    return <div className="h-32" aria-busy="true" />;
  }

  // When auto is on, show which season *is* effective (read-only preview)
  const effectiveSeason: Season = seasonAuto ? autoSeason() : season;

  return (
    <div className="space-y-6">
      {/* Mode (light / dark / system) */}
      <Section title={t("theme.modeTitle")}>
        <div className="grid grid-cols-3 gap-2">
          <ModeButton
            active={theme === "light"}
            onClick={() => setTheme("light")}
            icon={<JtIcon name="sun" size={16} />}
            label={t("theme.mode.light")}
          />
          <ModeButton
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            icon={<JtIcon name="moon" size={16} />}
            label={t("theme.mode.dark")}
          />
          <ModeButton
            active={theme === "system"}
            onClick={() => setTheme("system")}
            icon={<Monitor size={16} />}
            label={t("theme.mode.system")}
          />
        </div>

        <label className="flex items-center gap-3 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={oled}
            onChange={(e) => applyOled(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm">
            <span className="font-medium">{t("theme.oledTitle")}</span>{" "}
            <span className="text-(--muted)">{t("theme.oledHint")}</span>
          </span>
        </label>
      </Section>

      {/* Accent color */}
      <Section
        title={t("theme.accentTitle")}
        hint={
          (seasonAuto && effectiveSeason !== "default") ||
          (!seasonAuto && season !== "default")
            ? t("theme.accentDisabledBySeason")
            : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => {
            const meta = ACCENT_LABELS[a];
            const isActive = accent === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => applyAccent(a)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition",
                  isActive
                    ? "border-(--foreground) bg-(--background)"
                    : "border-(--border) bg-(--card) hover:bg-(--background) text-(--muted)"
                )}
                aria-pressed={isActive}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: ACCENT_SWATCHES[a] }}
                />
                {t(meta.nameKey)}
                {isActive && <JtIcon name="check" size={14} />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Seasonal */}
      <Section title={t("theme.seasonTitle")} hint={t("theme.seasonHint")}>
        <label className="flex items-center gap-3 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={seasonAuto}
            onChange={(e) => applySeasonAuto(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm">
            <span className="font-medium">{t("theme.seasonAutoTitle")}</span>{" "}
            <span className="text-(--muted)">{t("theme.seasonAutoHint")}</span>
            {seasonAuto && effectiveSeason !== "default" && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-(--accent)/15 text-(--accent)">
                {SEASON_LABELS[effectiveSeason].emoji}{" "}
                {t(SEASON_LABELS[effectiveSeason].nameKey)}
              </span>
            )}
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          {SEASONS.map((s) => {
            const meta = SEASON_LABELS[s];
            const isActive = !seasonAuto && season === s;
            const swatch = SEASON_SWATCHES[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => applySeason(s)}
                disabled={seasonAuto}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition",
                  seasonAuto && "opacity-50 cursor-not-allowed",
                  isActive
                    ? "border-(--foreground) bg-(--background)"
                    : "border-(--border) bg-(--card) hover:bg-(--background) text-(--muted)"
                )}
                aria-pressed={isActive}
              >
                <span className="text-base leading-none">{meta.emoji}</span>
                {t(meta.nameKey)}
                {s !== "default" && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: swatch }}
                  />
                )}
                {isActive && <JtIcon name="check" size={14} />}
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">{title}</h3>
      {hint && <p className="text-xs text-(--muted) mb-3">{hint}</p>}
      {children}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-xl border text-sm transition",
        active
          ? "border-(--accent) bg-(--accent)/10 text-(--foreground)"
          : "border-(--border) bg-(--card) hover:bg-(--background) text-(--muted)"
      )}
      aria-pressed={active}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
