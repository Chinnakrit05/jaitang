import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { requireSession } from "@/lib/session";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import type { IconName } from "@/components/icons";

const PEACH_STRONG = "#E89A6A";
const PEACH_GRADIENT =
  "linear-gradient(135deg, color-mix(in srgb, #F9D5B4 70%, var(--card)) 0%, color-mix(in srgb, #F4B58A 40%, var(--card)) 100%)";

/**
 * Mobile-first "more" page. Replaces the cramped bottom-sheet drawer
 * that used to fan out from the bottom-nav "more" tab. Layout:
 *   1. Identity card → links to /settings (palette / language / etc.)
 *   2. "Frequently used" — three big tiles for reports / accounts /
 *      transfers, the same shortcuts we want one tap away
 *   3. "General" — long-form list with icon + name + description
 */
export default async function MorePage() {
  const [{ user, ledger }, t] = await Promise.all([
    requireSession(),
    getTranslations(),
  ]);

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
      href: "/ledgers",
      label: t("more.accountsBook"),
      icon: "ledgers",
      bg: "color-mix(in srgb, #B6F0D8 60%, var(--card))",
      fg: "#1F8E62",
    },
    {
      href: "/transfers/new",
      label: t("more.transferShort"),
      icon: "arrow-left-right",
      bg: "color-mix(in srgb, #FFD1E5 60%, var(--card))",
      fg: "#C0367C",
    },
  ];

  const general: Array<{
    href: string;
    label: string;
    icon: IconName;
    desc: string;
  }> = [
    { href: "/goals",      label: t("nav.goals"),      icon: "goals",       desc: t("nav.descriptions.goals") },
    { href: "/loans",      label: t("nav.loans"),      icon: "loans",       desc: t("nav.descriptions.loans") },
    { href: "/calendar",   label: t("nav.calendar"),   icon: "calendar",    desc: t("nav.descriptions.calendar") },
    { href: "/budgets",    label: t("nav.budgets"),    icon: "budgets",     desc: t("nav.descriptions.budgets") },
    { href: "/categories", label: t("nav.categories"), icon: "categories",  desc: t("nav.descriptions.categories") },
    { href: "/recurring",  label: t("nav.recurring"),  icon: "recurring",   desc: t("nav.descriptions.recurring") },
    { href: "/trips",      label: t("nav.trips"),      icon: "trips",       desc: t("nav.descriptions.trips") },
    { href: "/balances",   label: t("nav.balances"),   icon: "balances",    desc: t("nav.descriptions.balances") },
    { href: "/accounts",   label: t("nav.accounts"),   icon: "accounts",    desc: t("nav.descriptions.accounts") },
    { href: "/chat",       label: t("nav.chat"),       icon: "chat",        desc: t("nav.descriptions.chat") },
    { href: "/quick",      label: t("nav.quick"),      icon: "quick",       desc: t("nav.descriptions.quick") },
    { href: "/import",     label: t("nav.import"),     icon: "import",      desc: t("nav.descriptions.import") },
    { href: "/settings",   label: t("nav.settings"),   icon: "settings",    desc: t("nav.descriptions.settings") },
  ];

  const display = user.name?.trim() || user.email || "—";

  return (
    <div className="max-w-md mx-auto pb-28 space-y-5">
      <h1 className="text-2xl font-bold">{t("nav.more")}</h1>

      {/* Identity card — links to settings since that's where palette /
          language / sign-out controls already live. */}
      <Link
        href="/settings"
        className="block rounded-2xl px-4 py-3 border"
        style={{
          background: PEACH_GRADIENT,
          borderColor: "color-mix(in srgb, #E89A6A 25%, transparent)",
        }}
      >
        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={display}
              className="h-12 w-12 rounded-full border border-(--card)/40"
            />
          ) : (
            <div
              className="h-12 w-12 rounded-full bg-(--card) flex items-center justify-center text-lg font-bold"
              style={{ color: PEACH_STRONG }}
            >
              {display.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{display}</p>
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

      {/* Frequently used — three big tiles */}
      <section>
        <h2 className="text-xs font-semibold text-(--muted) px-1 mb-2">
          {t("more.frequentlyUsed")}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {quick.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-(--border) bg-(--card) px-3 py-4 hover:bg-(--background) transition"
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

      {/* General — long-form list */}
      <section>
        <h2 className="text-xs font-semibold text-(--muted) px-1 mb-2">
          {t("more.general")}
        </h2>
        <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border)/60 overflow-hidden">
          {general.map((g) => (
            <li key={g.href}>
              <Link
                href={g.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition"
              >
                <span
                  className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: "color-mix(in srgb, #F9D5B4 40%, var(--card))",
                    color: PEACH_STRONG,
                  }}
                  aria-hidden
                >
                  <JtIcon name={g.icon} size={20} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px]">{g.label}</p>
                  <p className="text-xs text-(--muted) line-clamp-1">
                    {g.desc}
                  </p>
                </div>
                <JtIcon name="chevron-right" size={18} className="text-(--muted) shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
        className="px-1"
      >
        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl border border-(--border) bg-(--card) text-sm font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--background) transition"
        >
          <JtIcon name="logout" size={18} />
          {t("common.logoutFull")}
        </button>
      </form>
    </div>
  );
}
