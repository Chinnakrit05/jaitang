import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import { NavbarStat } from "@/components/navbar-stat";
import { sumPeriod } from "@/lib/transactions";
import { getNavbarPeriod, periodRange } from "@/lib/period";
import {
  LayoutDashboard,
  ListOrdered,
  FolderTree,
  LogOut,
  BookOpen,
  PiggyBank,
  Repeat,
  Scale,
  Settings,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";

type ActiveLedger = {
  id: string;
  name: string;
  icon: string | null;
  isPersonal: boolean;
  role: "owner" | "editor" | "viewer";
};

type DesktopNavItem = NavItem & { iconComponent: LucideIcon };

export async function DashboardShell({
  children,
  userName,
  userImage,
  activeLedger,
  ledgerCurrency = "THB",
}: {
  children: React.ReactNode;
  userName?: string | null;
  userImage?: string | null;
  activeLedger?: ActiveLedger | null;
  ledgerCurrency?: string;
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

  // Each entry has both:
  // - `iconComponent` — the actual Lucide function used by the desktop sidebar (server-rendered)
  // - `icon` — a string key passed to the MobileNav client component
  //   (we can't pass functions through the RSC boundary)
  const NAV: DesktopNavItem[] = [
    { href: "/dashboard",   label: t("nav.home"),         icon: "home",         iconComponent: LayoutDashboard },
    { href: "/quick",       label: t("nav.quick"),        icon: "quick",        iconComponent: Sparkles },
    { href: "/transactions",label: t("nav.transactions"), icon: "transactions", iconComponent: ListOrdered },
    { href: "/budgets",     label: t("nav.budgets"),      icon: "budgets",      iconComponent: PiggyBank },
    { href: "/recurring",   label: t("nav.recurring"),    icon: "recurring",    iconComponent: Repeat },
    { href: "/balances",    label: t("nav.balances"),     icon: "balances",     iconComponent: Scale },
    { href: "/categories",  label: t("nav.categories"),   icon: "categories",   iconComponent: FolderTree },
    { href: "/ledgers",     label: t("nav.ledgers"),      icon: "ledgers",      iconComponent: BookOpen },
    { href: "/import",      label: t("nav.import"),       icon: "import",       iconComponent: Upload },
    { href: "/settings",    label: t("nav.settings"),     icon: "settings",     iconComponent: Settings },
  ];

  const MOBILE_NAV: NavItem[] = [
    { href: "/dashboard",   label: t("nav.homeShort"),    icon: "home" },
    { href: "/quick",       label: t("nav.quickShort"),   icon: "quick" },
    { href: "/transactions",label: t("nav.transactions"), icon: "transactions" },
    { href: "/ledgers",     label: t("nav.ledgersShort"), icon: "ledgers" },
  ];

  // Strip iconComponent before handing to the client; only safe-to-serialize fields.
  const NAV_FOR_CLIENT: NavItem[] = NAV.map(({ href, label, icon }) => ({
    href,
    label,
    icon,
  }));

  const ROLE_LABEL: Record<string, string> = {
    owner: t("ledgers.roleOwner"),
    editor: t("ledgers.roleEditor"),
    viewer: t("ledgers.roleViewer"),
  };
  const personalLabel = t("ledgers.personal");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-(--border) sticky top-0 z-20 bg-(--background)/80 backdrop-blur">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-xl">📒</span>
          <span className="font-semibold hidden sm:inline">{t("appName")}</span>
        </Link>

        {activeLedger && (
          <Link
            href="/ledgers"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-(--border) bg-(--card) hover:bg-(--background) transition text-sm min-w-0"
          >
            <span className="shrink-0">{activeLedger.icon ?? "📒"}</span>
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
          <ThemeToggle />
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
              <LogOut size={16} />
              <span className="hidden sm:inline">{t("common.logout")}</span>
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 border-r border-(--border) bg-(--card)/50 px-3 py-6 gap-1">
          {NAV.map(({ href, label, iconComponent: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--background) transition"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </aside>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 max-w-6xl w-full mx-auto pb-20 md:pb-6">
          {children}
        </main>
      </div>

      <MobileNav primary={MOBILE_NAV} all={NAV_FOR_CLIENT} moreLabel={t("nav.more")} />
    </div>
  );
}
