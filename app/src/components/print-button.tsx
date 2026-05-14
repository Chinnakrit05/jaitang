"use client";

import { JtIcon } from "@/components/icons";

/**
 * Triggers the browser's print dialog. The user picks "Save as PDF"
 * from the destination list to get a PDF — works in every modern
 * browser without us shipping a server-side PDF renderer.
 *
 * Print CSS lives in globals.css under the `@media print` block to
 * declutter the UI (hides nav/sidebar, collapses cards onto one
 * page-friendly layout).
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) px-4 py-2 text-sm font-semibold hover:opacity-90 transition cta-primary"
    >
      <JtIcon name="download" size={18} />
      {label}
    </button>
  );
}
