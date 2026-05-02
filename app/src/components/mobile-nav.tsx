"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MoreHorizontal,
  X,
  CalendarDays,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  FolderTree,
  BookOpen,
  PiggyBank,
  Plane,
  Repeat,
  Scale,
  Settings,
  Sparkles,
  Target,
  Upload,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon names are passed by string from the server component because Lucide
 * icon components are functions (React.forwardRef) and the RSC payload can't
 * serialize functions across the server→client boundary.
 */
export type IconName =
  | "home"
  | "transactions"
  | "calendar"
  | "insights"
  | "categories"
  | "ledgers"
  | "budgets"
  | "recurring"
  | "balances"
  | "trips"
  | "goals"
  | "accounts"
  | "settings"
  | "quick"
  | "import";

const ICONS: Record<IconName, LucideIcon> = {
  home: LayoutDashboard,
  transactions: ListOrdered,
  calendar: CalendarDays,
  insights: LineChart,
  categories: FolderTree,
  ledgers: BookOpen,
  budgets: PiggyBank,
  recurring: Repeat,
  balances: Scale,
  trips: Plane,
  goals: Target,
  accounts: Wallet,
  settings: Settings,
  quick: Sparkles,
  import: Upload,
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export function MobileNav({
  primary,
  all,
  moreLabel,
}: {
  primary: NavItem[];
  all: NavItem[];
  moreLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Path-prefix match handles `/transactions/123/edit` highlighting the
  // Transactions tab. Exact match would feel wrong (the tab would dim
  // mid-flow). The "/" guard avoids matching everything when href is "/".
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav className="md:hidden border-t border-(--border) bg-(--card)/80 backdrop-blur fixed bottom-0 inset-x-0 z-20">
        <div className="flex justify-around py-2">
          {primary.map(({ href, label, icon }) => {
            const Icon = ICONS[icon];
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition",
                  active
                    ? "text-(--accent)"
                    : "text-(--muted) hover:text-(--foreground)"
                )}
              >
                {/* Top accent bar — visible only on the active route. The
                    `-mt-2` lifts it flush against the nav border so it
                    reads as "this tab is selected" rather than "underline
                    floating mid-icon". */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 -mt-2 rounded-full bg-(--accent)"
                  />
                )}
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-(--muted) hover:text-(--foreground)"
            aria-label={moreLabel}
          >
            <MoreHorizontal size={20} />
            {moreLabel}
          </button>
        </div>
      </nav>

      {open && (
        <>
          <button
            type="button"
            aria-label="close"
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-(--card) border-t border-(--border) rounded-t-2xl pb-safe shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
              <h2 className="font-semibold">{moreLabel}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-(--muted) hover:bg-(--background)"
                aria-label="close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              {all.map(({ href, label, icon }) => {
                const Icon = ICONS[icon];
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-(--background) border border-(--border) hover:border-(--accent) hover:bg-(--accent)/5 transition text-center"
                  >
                    <Icon size={22} className="text-(--accent)" />
                    <span className="text-xs font-medium leading-tight">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
