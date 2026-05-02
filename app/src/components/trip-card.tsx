"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, Check, Plane } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { setActiveTripAction } from "@/app/(app)/trips/actions";
import type { TripStats } from "@/lib/trips";

export function TripCard({
  trip,
  isActive,
  currency,
  fmtLocale,
}: {
  trip: TripStats;
  isActive: boolean;
  currency: string;
  fmtLocale: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function activate() {
    if (isActive || pending || trip.archived) return;
    startTransition(async () => {
      await setActiveTripAction(trip.id);
      router.refresh();
    });
  }

  const dateLabel = formatRange(trip.starts_at, trip.ends_at, fmtLocale);

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 relative",
        trip.archived
          ? "border-(--border) bg-(--card)/50 opacity-75"
          : isActive
          ? "border-(--accent) bg-(--accent)/5 ring-2 ring-(--accent)/30 card-hover"
          : "border-(--border) bg-(--card) hover:border-(--muted)/40 cursor-pointer card-hover",
        pending && "opacity-50"
      )}
      onClick={activate}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl shrink-0">{trip.icon ?? "✈️"}</span>
        <div className="flex-1 min-w-0">
          <Link
            href={`/trips/${trip.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold truncate block hover:underline"
          >
            {trip.name}
          </Link>
          <div className="text-xs text-(--muted) mt-0.5 flex items-center gap-1.5 flex-wrap">
            {dateLabel && <span>{dateLabel}</span>}
            <span>•</span>
            <span>{t("trips.txCount", { count: trip.txCount })}</span>
            {trip.archived && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Archive size={11} />
                  {t("trips.archivedBadge")}
                </span>
              </>
            )}
          </div>
        </div>
        {isActive && !trip.archived && (
          <Check size={18} className="text-(--accent) shrink-0" />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm tabular-nums">
        <span className="text-(--muted) text-xs flex items-center gap-1">
          <Plane size={12} />
          {t("trips.tripSpend")}
        </span>
        <span className="font-semibold text-(--expense)">
          −{formatCurrency(trip.totalExpense, currency, fmtLocale)}
        </span>
      </div>
    </li>
  );
}

function formatRange(
  startsAt: string | null,
  endsAt: string | null,
  fmtLocale: string
): string | null {
  if (!startsAt && !endsAt) return null;
  const fmt = new Intl.DateTimeFormat(fmtLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (startsAt && endsAt) {
    return `${fmt.format(new Date(startsAt))} – ${fmt.format(new Date(endsAt))}`;
  }
  if (startsAt) return `${fmt.format(new Date(startsAt))} →`;
  return `→ ${fmt.format(new Date(endsAt!))}`;
}
