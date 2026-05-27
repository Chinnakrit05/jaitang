import Link from "next/link";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import { NavbarStat } from "@/components/navbar-stat";
import { ActiveTripBanner } from "@/components/active-trip-banner";
import { sumPeriod } from "@/lib/transactions";
import { getNavbarPeriod, periodRange } from "@/lib/period";


type ActiveLedger = {
  id: string;
  name: string;
  icon: string | null;
  isPersonal: boolean;
  role: "owner" | "editor" | "viewer";
};

export async function DashboardShell({
  children,
  userName,
  userImage,
  activeLedger,
  ledgerCurrency = "THB",
  activeTripBanner,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userImage?: string | null;
  activeLedger?: ActiveLedger | null;
  ledgerCurrency?: string;
  activeTripBanner?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    txCount: number;
  } | null;
}) {
  const t = await getTranslations();

  // Period stat for the navbar — only when a ledger is active
  const period = await getNavbarPeriod();
  let periodStat: { income: number; expense: number } | null = null;
  if (activeLedger) {
    const { from, to } = periodRange(period);
    try {
      periodStat = await sumPeriod(activeLedger.id, from, to);
    } catch {
      periodStat = null;
    }
  }

  // Single nav source — both desktop sidebar and mobile sheet take the same
  // shape (`{href, label, icon}`). Icon is a string key resolved client-side
  // because Lucide icon components can't cross the RSC boundary.
  const NAV: NavItem[] = [
    { href: "/dashboard",    label: t("nav.home"),         icon: "home" },
    { href: "/quick",        label: t("nav.quick"),        icon: "quick" },
    { href: "/transactions", label: t("nav.transactions"), icon: "transactions" },
    { href: "/calendar",     label: t("nav.calendar"),     icon: "calendar" },
    { href: "/insights",     label: t("nav.insights"),     icon: "insights" },
    { href: "/chat",         label: t("nav.chat"),         icon: "chat" },
    { href: "/budgets",      label: t("nav.budgets"),      icon: "budgets" },
    { href: "/recurring",    label: t("nav.recurring"),    icon: "recurring" },
    { href: "/balances",     label: t("nav.balances"),     icon: "balances" },
    { href: "/accounts",     label: t("nav.accounts"),     icon: "accounts" },
    { href: "/loans",        label: t("nav.loans"),        icon: "loans" },
    { href: "/trips",        label: t("nav.trips"),        icon: "trips" },
    { href: "/goals",        label: t("nav.goals"),        icon: "goals" },
    { href: "/categories",   label: t("nav.categories"),   icon: "categories" },
    { href: "/ledgers",      label: t("nav.ledgers"),      icon: "ledgers" },
    { href: "/import",       label: t("nav.import"),       icon: "import" },
    { href: "/settings",     label: t("nav.settings"),     icon: "settings" },
  ];

  // Two primary tabs on each side of the center FAB. The FAB itself
  // is rendered by MobileNav as a fixed center slot and points at
  // /transactions/new. Five slots total (incl. the "more" button) to
  // match the mobile app's `AppTabBar`. Other routes live in the
  // "more" drawer.
  const MOBILE_NAV: NavItem[] = [
    { href: "/dashboard",   label: t("nav.homeShort"),    icon: "home" },
    { href: "/transactions",label: t("nav.transactions"), icon: "transactions" },
    // Reports replaced Insights on the footer bar — Insights stays
    // reachable via /more and the URL itself, just no longer in the
    // primary tab strip.
    { href: "/reports",     label: t("more.reports"),     icon: "insights" },
  ];

  const ROLE_LABEL: Record<string, string> = {
    owner: t("ledgers.roleOwner"),
    editor: t("ledgers.roleEditor"),
    viewer: t("ledgers.roleViewer"),
  };
  const personalLabel = t("ledgers.personal");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar — fully hidden. We adopted the mobile shell as the
          canonical layout for every viewport, so the desktop header
          (logo / ledger pill / period stat / theme toggle / logout)
          is gone. Those controls live on /more and /settings instead.

          Keeping the <header> markup as `hidden` rather than deleted
          so the props (NavbarStat / ThemeToggle / signOut form) still
          have a stable home if we ever want a tablet/desktop variant
          back. */}
      <header className="hidden items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-(--border) header-accent-edge sticky top-0 z-20 bg-(--background)/80 backdrop-blur">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">📒</span>
          <span className="font-semibold hidden sm:inline">{t("appName")}</span>
        </Link>

        {activeLedger && (
          <Link
            href="/ledgers"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-(--border) bg-(--card) hover:bg-(--background) transition text-sm min-w-0"
          >
            <span className="shrink-0"><EmojiOrIcon value={activeLedger.icon} fallback="users" size={20} /></span>
            <span className="font-medium truncate max-w-[140px]">
              {activeLedger.name}
            </span>
            <span className="text-xs text-(--muted) shrink-0 hidden sm:inline">
              {activeLedger.isPersonal ? personalLabel : ROLE_LABEL[activeLedger.role]}
            </span>
          </Link>
        )}

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {periodStat && (
            <NavbarStat
              income={periodStat.income}
              expense={periodStat.expense}
              period={period}
              currency={ledgerCurrency}
            />
          )}
          {/* Hide on mobile: header gets too crowded with the period stat
              already taking up width. Theme can still be toggled from the
              Settings page on small screens. */}
          <div className="hidden sm:inline-flex">
            <ThemeToggle />
          </div>
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImage}
              alt={userName ?? "user"}
              className="h-9 w-9 rounded-full border border-(--border)"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-(--card) border border-(--border) flex items-center justify-center text-sm font-semibold">
              {(userName ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground) transition"
              aria-label={t("common.logoutFull")}
            >
              <JtIcon name="logout" size={20} />
              <span className="hidden sm:inline">{t("common.logout")}</span>
            </button>
          </form>
        </div>
      </header>

      {activeTripBanner && (
        <ActiveTripBanner
          tripId={activeTripBanner.id}
          tripName={activeTripBanner.name}
          tripIcon={activeTripBanner.icon}
          tripColor={activeTripBanner.color}
          txCount={activeTripBanner.txCount}
        />
      )}

      {/* DesktopSidebar removed from the tree — every viewport now
          uses the mobile shell. Phone keeps the strict mobile width;
          tablet / desktop get a roomier column so forms with grids
          (categories, insights drill-downs, etc.) don't choke on
          448px. Still narrower than the old multi-col layout so the
          page reads as a phone-style stack, just less cramped. */}
      <main
        className="w-full max-w-md md:max-w-2xl lg:max-w-3xl mx-auto px-4 pb-24"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 1.5rem)",
        }}
      >
        {children}
      </main>

      <MobileNav
        primary={MOBILE_NAV}
        all={NAV}
        moreLabel={t("nav.more")}
        fabLabel={t("dashboard.addTransaction")}
      />
    </div>
  );
}
