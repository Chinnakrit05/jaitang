"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import type { IconName } from "@/components/icons";
import { MobileNav, type NavItem } from "@/components/mobile-nav";

const PEACH_STRONG = "var(--peach-strong)";
const PEACH_GRADIENT =
  "linear-gradient(135deg, color-mix(in srgb, var(--peach-soft) 70%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 40%, var(--card)) 100%)";

/**
 * Public preview for the redesigned /more page. Mirrors the layout of
 * `(app)/more/page.tsx` but with fixture session data so designers can
 * iterate without logging in. Keep the two in sync — when /more
 * structure changes, mirror the change here too.
 */
export default function MorePreviewPage() {
  const t = useTranslations();

  const user = {
    name: "dev",
    email: "dev@jaitang.local",
    image: null as string | null,
  };
  const ledger = { name: "สมุดขอ", icon: "📒", currency: "THB" };
  const display = user.name || user.email;

  const quick: Array<{
    href: string;
    label: string;
    icon: IconName;
    bg: string;
    fg: string;
  }> = [
    {
      href: "/reports",
      label: t("more.reports"),
      icon: "insights",
      bg: "color-mix(in srgb, #FFD1E5 60%, var(--card))",
      fg: "#C0367C",
    },
    {
      href: "/recurring",
      label: t("nav.recurring"),
      icon: "recurring",
      bg: "color-mix(in srgb, #DDD6FE 60%, var(--card))",
      fg: "#6D28D9",
    },
    {
      href: "/ledgers",
      label: t("more.accountsBook"),
      icon: "ledgers",
      bg: "color-mix(in srgb, #B6F0D8 60%, var(--card))",
      fg: "#1F8E62",
    },
  ];

  // Mirror the trim applied to /more — goals / loans / budgets /
  // chat / quick are hidden for now.
  const general: Array<{ href: string; label: string; icon: IconName; desc: string }> = [
    { href: "/calendar",   label: t("nav.calendar"),   icon: "calendar",   desc: t("nav.descriptions.calendar") },
    { href: "/categories", label: t("nav.categories"), icon: "categories", desc: t("nav.descriptions.categories") },
    { href: "/trips",      label: t("nav.trips"),      icon: "trips",      desc: t("nav.descriptions.trips") },
    { href: "/balances",   label: t("nav.balances"),   icon: "balances",   desc: t("nav.descriptions.balances") },
    { href: "/accounts",   label: t("nav.accounts"),   icon: "accounts",   desc: t("nav.descriptions.accounts") },
    { href: "/import",     label: t("nav.import"),     icon: "import",     desc: t("nav.descriptions.import") },
    { href: "/settings",   label: t("nav.settings"),   icon: "settings",   desc: t("nav.descriptions.settings") },
  ];

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/reports", label: "รายงาน", icon: "insights" },
  ];

  return (
    <div className="min-h-screen pb-32 soft-page">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        <h1 className="text-2xl font-bold">{t("nav.more")}</h1>

        <Link
          href="/settings"
          className="block rounded-2xl px-4 py-3 border"
          style={{
            background: PEACH_GRADIENT,
            borderColor: "color-mix(in srgb, var(--peach-strong) 25%, transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full bg-(--card) flex items-center justify-center text-lg font-bold"
              style={{ color: PEACH_STRONG }}
            >
              {display.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{user.email}</p>
              <p className="text-xs text-(--foreground)/70 flex items-center gap-1 mt-0.5">
                <EmojiOrIcon value={ledger.icon} fallback="ledgers" size={14} />
                <span className="truncate">{ledger.name}</span>
                <span>·</span>
                <span className="font-medium">{ledger.currency}</span>
              </p>
            </div>
            <JtIcon name="chevron-right" size={18} className="text-(--foreground)/60 shrink-0" />
          </div>
        </Link>

        <section>
          <h2 className="text-xs font-semibold text-(--muted) px-1 mb-2">
            {t("more.frequentlyUsed")}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {quick.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex flex-col items-center gap-2 rounded-[22px] soft-raised px-3 py-4 hover:bg-(--background) transition"
              >
                <span
                  className="h-14 w-14 rounded-2xl flex items-center justify-center"
                  style={{ background: q.bg, color: q.fg }}
                >
                  <JtIcon name={q.icon} size={30} />
                </span>
                <span className="text-sm font-semibold text-center leading-tight">
                  {q.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-(--muted) px-1 mb-2">
            {t("more.general")}
          </h2>
          <ul className="rounded-[22px] soft-raised divide-y divide-(--border)/60 overflow-hidden">
            {general.map((g) => (
              <li key={g.href}>
                <Link
                  href={g.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition"
                >
                  <span
                    className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: "color-mix(in srgb, var(--peach-soft) 40%, var(--card))",
                      color: PEACH_STRONG,
                    }}
                    aria-hidden
                  >
                    <JtIcon name={g.icon} size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px]">{g.label}</p>
                    <p className="text-xs text-(--muted) line-clamp-1">{g.desc}</p>
                  </div>
                  <JtIcon name="chevron-right" size={18} className="text-(--muted) shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <MobileNav
        primary={navPrimary}
        moreLabel="เพิ่มเติม"
        fabLabel="เพิ่มรายการ"
      />
    </div>
  );
}
