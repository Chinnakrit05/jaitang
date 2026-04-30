import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
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
} from "lucide-react";

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
}: {
  children: React.ReactNode;
  userName?: string | null;
  userImage?: string | null;
  activeLedger?: ActiveLedger | null;
}) {
  const t = await getTranslations();

  const NAV = [
    { href: "/dashboard", label: t("nav.home"), icon: LayoutDashboard },
    { href: "/transactions", label: t("nav.transactions"), icon: ListOrdered },
    { href: "/budgets", label: t("nav.budgets"), icon: PiggyBank },
    { href: "/recurring", label: t("nav.recurring"), icon: Repeat },
    { href: "/balances", label: t("nav.balances"), icon: Scale },
    { href: "/categories", label: t("nav.categories"), icon: FolderTree },
    { href: "/ledgers", label: t("nav.ledgers"), icon: BookOpen },
    { href: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  const MOBILE_NAV = [
    { href: "/dashboard", label: t("nav.homeShort"), icon: LayoutDashboard },
    { href: "/transactions", label: t("nav.transactions"), icon: ListOrdered },
    { href: "/budgets", label: t("nav.budgetsShort"), icon: PiggyBank },
    { href: "/ledgers", label: t("nav.ledgersShort"), icon: BookOpen },
  ];

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

        <div className="flex items-center gap-3 ml-auto">
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
          {NAV.map(({ href, label, icon: Icon }) => (
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

      <nav className="md:hidden border-t border-(--border) bg-(--card)/80 backdrop-blur fixed bottom-0 inset-x-0 z-20">
        <div className="flex justify-around py-2">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-(--muted) hover:text-(--foreground)"
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
