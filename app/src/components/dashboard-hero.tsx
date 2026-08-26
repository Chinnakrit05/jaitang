import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AnimatedAmount } from "@/components/animated-amount";
import { EmojiOrIcon } from "@/components/icons";
import { PetName } from "@/components/pet-name";

/**
 * Hero balance card — replaces the 3-up SummaryCard grid with a single
 * peach card that puts month balance, income/expense chips, and a budget
 * mood line front-and-center alongside the Shiba mascot.
 *
 * Layout ported from `jaitang-mobile/app/(app)/dashboard.tsx`, with three
 * deliberate upgrades on top of the mobile original:
 *   1. Negative balance uses a tinted expense color + a true Unicode
 *      minus (`−`), so the figure reads as "you spent more than you
 *      earned" rather than just "a number happens to have a dash."
 *   2. Budget bar fill color tracks the mood (green / amber / rose) and
 *      caps visually at 100% so the eye registers "over budget" at a
 *      glance — backed up by an explicit "เกินงบ X%" copy line.
 *   3. When no budget is set we render the bar as a neutral track with
 *      a "ยังไม่ตั้งงบ" note rather than dividing by a mocked cap.
 */
export async function DashboardHero({
  name,
  income,
  expense,
  balance,
  budgetCap,
  currency,
  fmtLocale,
  monthLabel,
  ledgerName,
  ledgerIcon,
}: {
  name: string;
  income: number;
  expense: number;
  balance: number;
  budgetCap: number;
  currency: string;
  fmtLocale: string;
  monthLabel: string;
  ledgerName: string;
  ledgerIcon?: string | null;
}) {
  const t = await getTranslations();

  const hasBudget = budgetCap > 0;
  const usagePct = hasBudget ? Math.round((expense / budgetCap) * 100) : 0;
  // Clamp the visual bar so we don't try to draw past 100% — but keep
  // the raw percent for the copy line so the user knows how far over.
  const barPct = Math.min(100, Math.max(0, usagePct));
  const overPct = hasBudget && usagePct > 100 ? usagePct - 100 : 0;

  // Three states drive both the mood label and the bar tint.
  const moodKey = !hasBudget
    ? "none" // strip is not rendered in this case; kept so the type stays honest
    : usagePct >= 100
    ? "over"
    : usagePct >= 70
    ? "worried"
    : "happy";

  const moodLabel =
    moodKey === "over"
      ? t("dashboard.moodOver")
      : moodKey === "worried"
      ? t("dashboard.moodWorried")
      : moodKey === "happy"
      ? t("dashboard.moodHappy")
      : null;

  const barColor =
    moodKey === "over"
      ? "var(--expense)"
      : moodKey === "worried"
      ? "#f59e0b" // amber-500 — flagged but not alarming
      : moodKey === "happy"
      ? "var(--income)"
      : "var(--muted)";

  const balanceColor = balance < 0 ? "text-(--expense)" : "text-(--foreground)";
  const sign = balance < 0 ? "−" : balance > 0 ? "+" : "";

  return (
    <section className="space-y-4 fade-rise">
      {/* Greeting row */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/settings"
          aria-label={t("settings.title")}
          className="flex items-center gap-3 min-w-0 flex-1 rounded-full -m-1 p-1"
        >
          <div className="min-w-0">
            <div className="text-xs text-(--muted)">{t("dashboard.helloShort")}</div>
            <div className="text-base font-semibold truncate">{name}</div>
          </div>
        </Link>
        <Link
          href="/ledgers"
          aria-label={t("more.accountsBook")}
          className="group shrink-0 h-11 max-w-[55%] rounded-full soft-raised-sm soft-pressable flex items-center gap-2 pl-1 pr-3.5"
        >
          <span
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 shadow-sm text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--peach-strong) 0%, var(--peach-deep) 100%)",
            }}
            aria-hidden
          >
            <EmojiOrIcon value={ledgerIcon ?? null} fallback="ledgers" size={18} />
          </span>
          <span className="flex flex-col min-w-0 leading-tight">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider text-(--muted)"
            >
              {t("more.accountsBook")}
            </span>
            <span
              className="text-sm font-bold truncate"
            >
              {ledgerName}
            </span>
          </span>
        </Link>
      </div>

      {/* Hero card — peach gradient, mascot floats in the top-right
          corner with a slow bob (CSS keyframes). */}
      <div
        className="relative overflow-hidden rounded-[30px] p-5 sm:p-6 soft-raised-lg"
      >
        <div>
          <div className="text-xs text-(--muted)">{t("dashboard.monthBalance")}</div>
          <div className="text-[11px] text-(--muted) mt-0.5">
            ‹ {monthLabel} ›
          </div>
          <div
            className={`mt-3 text-3xl sm:text-4xl font-bold tabular-nums tracking-tight ${balanceColor}`}
          >
            <AnimatedAmount
              value={balance}
              currency={currency}
              fmtLocale={fmtLocale}
              prefix={sign}
            />
          </div>

        </div>

        <div className="mt-4 rounded-[20px] soft-well px-4 py-3 flex">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-(--muted)">{t("common.income")}</div>
            <div
              className="text-base font-bold tabular-nums truncate"
              style={{ color: "var(--income)" }}
            >
              <AnimatedAmount
                value={income}
                currency={currency}
                fmtLocale={fmtLocale}
              />
            </div>
          </div>
          <div
            className="w-px mx-3 shrink-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--soft-well-shade), transparent)",
            }}
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-(--muted)">{t("common.expense")}</div>
            <div
              className="text-base font-bold tabular-nums truncate"
              style={{ color: "var(--expense)" }}
            >
              <AnimatedAmount
                value={expense}
                currency={currency}
                fmtLocale={fmtLocale}
              />
            </div>
          </div>
        </div>

        {/* Mood + progress strip. Only rendered once a budget exists —
            a bar with no cap has nothing to measure against, and a line
            saying so is noise on the one screen people check daily. */}
        {hasBudget && (
        <div className="mt-4 relative">
          <div className="text-[13px]">
            <PetName className="font-medium" />
            <span className="text-(--muted) text-xs">
              {"  "}
              {moodKey === "over" && overPct > 0
                ? `${moodLabel} · ${t("dashboard.budgetOverBy", { pct: String(overPct) })}`
                : `${moodLabel} · ${t("dashboard.budgetPercent", { pct: String(usagePct) })}`}
            </span>
          </div>
          <div className="mt-2.5 h-3.5 rounded-full soft-well-sm p-[3px] overflow-hidden">
            <div
              className="h-full rounded-full bar-fill"
              style={
                {
                  background: barColor,
                  "--bar-target": `${barPct}%`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
        )}
      </div>
    </section>
  );
}
