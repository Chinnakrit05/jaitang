"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { JtIcon } from "@/components/icons";

/**
 * Nav routes the app exposes. The server passes only the string name across
 * the RSC boundary — JtIcon resolves it to the right `<symbol>` in the sprite
 * at render time.
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
  | "loans"
  | "chat"
  | "settings"
  | "quick"
  | "import";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export function MobileNav({
  primary,
  moreLabel,
  fabLabel,
}: {
  primary: NavItem[];
  /** Retained for ABI compatibility with callers (preview routes). */
  all?: NavItem[];
  moreLabel: string;
  /** Accessible label for the floating "+" button that links to the
   *  new-transaction page. Required because the FAB has no visible
   *  text (icon-only). */
  fabLabel: string;
}) {
  const pathname = usePathname();
  // Path-prefix match handles `/transactions/123/edit` highlighting the
  // Transactions tab. Exact match would feel wrong (the tab would dim
  // mid-flow). The "/" guard avoids matching everything when href is "/".
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Split `primary` so the FAB lands in the middle of the bar — first
  // half on the left, second half on the right, FAB raised between them.
  // Pass exactly 4 items in `primary` for a centered FAB; fewer/more
  // still works but the FAB drifts.
  const splitAt = Math.ceil(primary.length / 2);
  const leftItems = primary.slice(0, splitAt);
  const rightItems = primary.slice(splitAt);

  function renderTab({ href, label, icon }: NavItem) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "relative flex flex-1 flex-col items-center gap-0.5 px-1 py-1 text-xs transition",
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
        <JtIcon name={icon} size={24} />
        <span className="truncate max-w-full">{label}</span>
      </Link>
    );
  }

  return (
    <>
      <nav
        className="border-t border-(--border) bg-(--card)/80 backdrop-blur fixed bottom-0 inset-x-0 z-20"
        style={{
          // Push the bar's bottom edge above the iPhone home indicator
          // when running standalone (PWA). `env(safe-area-inset-bottom)`
          // resolves to ~34px on iPhones with the gesture bar, 0 on
          // devices without it — so the same markup works both ways.
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto flex items-end justify-around py-2 px-2">
          {leftItems.map(renderTab)}

          {/* Center FAB — quick-add path. Raised above the bar with the
              accent fill so the eye finds it without a label. The
              negative top margin lets it "punch through" the border. */}
          <Link
            href="/transactions/new"
            aria-label={fabLabel}
            className="flex items-center justify-center h-14 w-14 rounded-full bg-(--accent) text-(--accent-foreground) -mt-6 shrink-0 shadow-[0_8px_20px_-6px_color-mix(in_srgb,var(--accent)_60%,transparent)] hover:scale-105 active:scale-95 transition"
          >
            <JtIcon name="plus-fab" size={28} />
          </Link>

          {rightItems.map(renderTab)}

          <Link
            href="/more"
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 px-1 py-1 text-xs transition",
              isActive("/more")
                ? "text-(--accent)"
                : "text-(--muted) hover:text-(--foreground)"
            )}
            aria-label={moreLabel}
          >
            {isActive("/more") && (
              <span
                aria-hidden
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 -mt-2 rounded-full bg-(--accent)"
              />
            )}
            <JtIcon name="more" size={24} />
            <span className="truncate max-w-full">{moreLabel}</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
