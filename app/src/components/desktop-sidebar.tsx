"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
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
  HandCoins,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { NavItem, IconName } from "@/components/mobile-nav";

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
  loans: HandCoins,
  chat: MessageCircle,
  settings: Settings,
  quick: Sparkles,
  import: Upload,
};

/**
 * Desktop sidebar (≥md). Renders the same nav items as MobileNav but with
 * an active-state highlight that tints in accent — gives the visual
 * confirmation "you're on this page" while also making the chosen accent
 * very visible on every screen.
 */
export function DesktopSidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-(--border) bg-(--card)/50 px-3 py-6 gap-1">
      {items.map(({ href, label, icon }) => {
        const Icon = ICONS[icon];
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition relative",
              active
                ? "nav-active"
                : "text-(--muted) hover:text-(--foreground) hover:bg-(--background)"
            )}
          >
            {/* Left rail in accent — only on active */}
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-(--accent)"
              />
            )}
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
