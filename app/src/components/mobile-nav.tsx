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
          "relative flex flex-1 flex-col items-center gap-0.5 px-1 py-1.5 text-xs transition",
          active
            ? "text-(--accent)"
            : "text-(--muted) hover:text-(--foreground)"
        )}
      >
        {/* Active marker. The old version was a rule flush against the
            nav's top border; the capsule has no such edge, so it drops
            to a dot beneath the label. */}
        {active && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-(--accent)"
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
        className="fixed bottom-0 inset-x-0 z-20 px-3 pt-2 pointer-events-none"
        style={{
          // Keep the capsule clear of the iPhone home indicator when
          // running standalone (PWA). `env(safe-area-inset-bottom)`
          // resolves to ~34px on iPhones with the gesture bar, 0 on
          // devices without it — so the same markup works both ways.
          // The 12px floor is the gap the floating bar needs on the
          // devices that report 0.
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="pointer-events-auto max-w-md md:max-w-2xl lg:max-w-3xl mx-auto flex items-center justify-around rounded-[26px] soft-well px-2 py-1.5">
          {leftItems.map(renderTab)}

          {/* Center FAB — quick-add path. A raised disc in the surface
              colour, sunk when pressed: the glossy accent sphere it
              replaced was the last object still lit from its own light
              source, which is the one thing this treatment cannot have.
              The glyph carries the only colour, in --peach-deep so it
              still follows whichever pet palette is active. */}
          <Link
            href="/transactions/new"
            aria-label={fabLabel}
            className="relative flex items-center justify-center h-14 w-14 rounded-full shrink-0 soft-raised soft-pressable active:scale-95 transition"
            style={{ color: "var(--peach-deep)" }}
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
                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-(--accent)"
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
