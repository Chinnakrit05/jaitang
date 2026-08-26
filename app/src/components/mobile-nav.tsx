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
        className="fixed bottom-0 inset-x-0 z-20 bg-(--soft-surface) shadow-[0_-6px_14px_-8px_var(--soft-shade)]"
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
              accent fill so the eye finds it without a label. Layered
              gradient + highlight + ring give the button a tactile 3D
              feel instead of looking like a flat sticker. */}
          <Link
            href="/transactions/new"
            aria-label={fabLabel}
            className="relative flex items-center justify-center h-16 w-16 rounded-full -mt-7 shrink-0 text-(--accent-foreground) hover:scale-105 active:scale-95 transition"
            style={{
              background:
                "radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--accent) 55%, white) 0%, var(--accent) 45%, color-mix(in srgb, var(--accent) 70%, black) 100%)",
              boxShadow: [
                "0 10px 22px -6px color-mix(in srgb, var(--accent) 65%, transparent)",
                "0 3px 8px -2px color-mix(in srgb, var(--accent) 50%, transparent)",
                "inset 0 1px 0 0 rgba(255,255,255,0.55)",
                "inset 0 -2px 4px 0 color-mix(in srgb, var(--accent) 60%, black)",
              ].join(", "),
            }}
          >
            {/* Specular highlight — a soft top arc that catches the
                "light" so the sphere reads as a sphere, not a disc. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 h-3 w-8 rounded-full"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.7), rgba(255,255,255,0))",
                filter: "blur(1.5px)",
              }}
            />
            <JtIcon
              name="plus-fab"
              size={30}
              className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]"
            />
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
