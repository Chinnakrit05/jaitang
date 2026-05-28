import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Mascot } from "@/components/mascots";
import { AnimatedAmount } from "@/components/animated-amount";
import { JtIcon } from "@/components/icons";

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
  avatarUrl,
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
  avatarUrl?: string | null;
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
    ? "none"
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
          className="flex items-center gap-3 min-w-0 flex-1 rounded-full -m-1 p-1 hover:bg-(--card)/60 transition"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={name}
              className="h-11 w-11 rounded-full border border-(--border)"
            />
          ) : (
            <div className="h-11 w-11 rounded-full bg-(--card) border border-(--border) flex items-center justify-center text-xl">
              🦊
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs text-(--muted)">{t("dashboard.helloShort")}</div>
            <div className="text-base font-semibold truncate">{name}</div>
          </div>
        </Link>
        <Link
          href="/ledgers"
          aria-label={t("more.accountsBook")}
          className="group shrink-0 h-11 max-w-[55%] rounded-full border flex items-center gap-2 pl-1 pr-3.5 shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 transition"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--peach-soft) 55%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 28%, var(--card)) 100%)",
            borderColor:
              "color-mix(in srgb, var(--peach-strong) 35%, transparent)",
          }}
        >
          <span
            className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0 shadow-sm"
            style={{
              background:
                "linear-gradient(135deg, var(--peach-strong) 0%, var(--peach-deep) 100%)",
            }}
            aria-hidden
          >
            {ledgerIcon ? (
              <span className="leading-none">{ledgerIcon}</span>
            ) : (
              <JtIcon name="ledgers" className="h-4 w-4 text-white" />
            )}
          </span>
          <span className="flex flex-col min-w-0 leading-tight">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--peach-chip-fg)" }}
            >
              {t("more.accountsBook")}
            </span>
            <span
              className="text-sm font-bold truncate"
              style={{ color: "var(--peach-fg)" }}
            >
              {ledgerName}
            </span>
          </span>
        </Link>
      </div>

      {/* Hero card — peach gradient, mascot floats in the top-right
          corner with a slow bob (CSS keyframes). */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-(--border)"
        style={{
          background:
            "linear-gradient(140deg, color-mix(in srgb, var(--peach-soft) 60%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 30%, var(--card)) 100%)",
        }}
      >
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 pointer-events-none mascot-float">
          <Mascot size={92} idPrefix="hero" />
        </div>

        <div className="pr-24 sm:pr-28">
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

          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: "color-mix(in srgb, var(--card) 80%, transparent)",
              }}
            >
              <span style={{ color: "var(--income)" }} aria-hidden>
                ▲
              </span>
              {t("common.income")}{" "}
              <span className="tabular-nums">
                <AnimatedAmount
                  value={income}
                  currency={currency}
                  fmtLocale={fmtLocale}
                />
              </span>
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: "color-mix(in srgb, var(--card) 80%, transparent)",
              }}
            >
              <span style={{ color: "var(--expense)" }} aria-hidden>
                ▼
              </span>
              {t("common.expense")}{" "}
              <span className="tabular-nums">
                <AnimatedAmount
                  value={expense}
                  currency={currency}
                  fmtLocale={fmtLocale}
                />
              </span>
            </span>
          </div>
        </div>

        {/* Mood + progress strip — sits below the chips and spans the
            full width so the bar has room to breathe. */}
        <div
          className="mt-4 px-3 py-2.5 rounded-2xl relative"
          style={{
            background: "color-mix(in srgb, var(--card) 70%, transparent)",
          }}
        >
          <div className="text-[13px]">
            <span className="font-medium">{t("dashboard.mascotName")}</span>
            <span className="text-(--muted) text-xs">
              {"  "}
              {moodKey === "over" && overPct > 0
                ? `${moodLabel} · ${t("dashboard.budgetOverBy", { pct: String(overPct) })}`
                : moodKey === "none"
                ? t("dashboard.budgetNone")
                : `${moodLabel} · ${t("dashboard.budgetPercent", { pct: String(usagePct) })}`}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 rounded-full overflow-hidden"
            style={{
              background: "color-mix(in srgb, var(--foreground) 8%, transparent)",
            }}
          >
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
      </div>
    </section>
  );
}
