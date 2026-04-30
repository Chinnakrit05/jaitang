"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MoreHorizontal, X, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Mobile bottom nav with overflow sheet.
 * - 4 most-used items shown as bottom tabs
 * - 5th tab is "More" → opens a slide-up sheet with the full menu
 */
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

  // Close sheet on Escape + lock body scroll while open
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
          {primary.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-(--muted) hover:text-(--foreground)"
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
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
          {/* Backdrop */}
          <button
            type="button"
            aria-label="close"
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          {/* Sheet */}
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
              {all.map(({ href, label, icon: Icon }) => (
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
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
