"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plane, X } from "lucide-react";
import { clearActiveTripAction } from "@/app/(app)/trips/actions";

/**
 * Thin status bar that sits below the navbar whenever the user has an
 * "active" trip set. It tells them every new transaction will be tagged
 * to this trip until they hit the X.
 */
export function ActiveTripBanner({
  tripId,
  tripName,
  tripIcon,
  tripColor,
  txCount,
}: {
  tripId: string;
  tripName: string;
  tripIcon: string | null;
  tripColor: string | null;
  txCount: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function deactivate(e: React.MouseEvent) {
    // Prevent the parent <Link> from navigating to /trips/[id] when the
    // user clicks the close button.
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await clearActiveTripAction();
      router.refresh();
    });
  }

  // Use the trip's color as a thin left accent strip — keeps the banner
  // minimal while still letting the user feel which trip they're in.
  const accent = tripColor ?? "var(--accent)";

  return (
    <div
      className="border-b border-(--border) bg-(--card)/60 backdrop-blur"
      style={{ boxShadow: `inset 3px 0 0 ${accent}` }}
    >
      <Link
        href={`/trips/${tripId}`}
        className="flex items-center gap-2 px-4 sm:px-6 py-2 text-sm hover:bg-(--background)/50 transition"
      >
        <Plane
          size={14}
          className="shrink-0"
          style={{ color: accent }}
        />
        <span className="text-base shrink-0">{tripIcon ?? "✈️"}</span>
        <span className="font-medium truncate">{tripName}</span>
        <span className="text-(--muted) text-xs hidden sm:inline">
          • {t("trips.activeBannerHint", { count: txCount })}
        </span>
        <span className="ml-auto text-(--muted) text-xs hidden sm:inline">
          {t("trips.activeBannerCta")}
        </span>
        <button
          type="button"
          onClick={deactivate}
          disabled={pending}
          aria-label={t("trips.deactivate")}
          title={t("trips.deactivate")}
          className="ml-1 sm:ml-2 p-1 rounded-md text-(--muted) hover:bg-(--card) hover:text-(--foreground) disabled:opacity-50"
        >
          <X size={14} />
        </button>
      </Link>
    </div>
  );
}
