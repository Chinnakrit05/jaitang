"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Pill row that swaps the dashboard between "home currency view" (the
 * default) and "<foreign currency> only" filtered views. Hidden when the
 * current period has no foreign-currency rows — no point showing a
 * single-pill row.
 *
 * URL contract: `?cur=<CODE>` selects a foreign-currency filter; absence
 * means home view. We don't bother with a `?cur=THB` form since that's
 * the implicit default.
 */
export function DashboardCurrencyToggle({
  homeCurrency,
  available, // foreign currencies present in this period (no home, no dupes)
}: {
  homeCurrency: string;
  available: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const active = params.get("cur") ?? "";

  function setCur(code: string) {
    const sp = new URLSearchParams(params.toString());
    if (code === "" || code === homeCurrency) sp.delete("cur");
    else sp.set("cur", code);
    const qs = sp.toString();
    startTransition(() => router.push(`/dashboard${qs ? `?${qs}` : ""}`));
  }

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap",
        pending && "opacity-60"
      )}
    >
      <Pill
        label={`${homeCurrency} · ${t("dashboard.allCurrencies")}`}
        selected={active === ""}
        onClick={() => setCur("")}
      />
      {available.map((code) => (
        <Pill
          key={code}
          label={code}
          selected={active === code}
          onClick={() => setCur(code)}
        />
      ))}
    </div>
  );
}

function Pill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition border",
        selected
          ? "bg-(--foreground) text-(--background) border-transparent shadow-sm"
          : "border-(--border) bg-(--card) text-(--muted) hover:text-(--foreground) hover:border-(--muted)/40"
      )}
    >
      {label}
    </button>
  );
}
