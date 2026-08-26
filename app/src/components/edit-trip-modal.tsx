"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { JtIcon, EmojiOrIcon, type IconName } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { CurrencyPicker } from "@/components/currency-picker";
import { updateTripDetailsAction } from "@/app/(app)/trips/actions";
import type { Trip } from "@/lib/types";

const ICON_CHOICES: IconName[] = [
  "airplane",
  "beach",
  "mountain",
  "ramen",
  "party",
  "backpack",
  "car",
  "cruise-ship",
  "camping",
  "gift",
];
const DEFAULT_TRIP_ICON: IconName = "airplane";
const COLOR_CHOICES = [
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

/**
 * Single-modal editor for a trip's metadata. Shown from the trip detail
 * page. Currency-change effects are described in `updateTripDetailsAction`
 * — TL;DR: changing the currency does NOT retro-convert old rows.
 */
export function EditTripModal({
  trip,
  ledgerCurrency,
}: {
  trip: Trip;
  ledgerCurrency: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local form state, seeded from current trip on every open so a
  // user who clicks "edit", types, then cancels gets a clean slate
  // next time.
  const [name, setName] = useState(trip.name);
  const [icon, setIcon] = useState(trip.icon ?? DEFAULT_TRIP_ICON);
  const [color, setColor] = useState(trip.color ?? "#3b82f6");
  const [currency, setCurrency] = useState(trip.currency ?? ledgerCurrency);
  const dialogRef = useRef<HTMLDivElement>(null);

  function openModal() {
    setName(trip.name);
    setIcon(trip.icon ?? DEFAULT_TRIP_ICON);
    setColor(trip.color ?? "#3b82f6");
    setCurrency(trip.currency ?? ledgerCurrency);
    setError(null);
    setOpen(true);
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("icon", icon);
    fd.set("color", color);
    fd.set("currency", currency);
    startTransition(async () => {
      const result = await updateTripDetailsAction(trip.id, fd);
      if (result && "ok" in result && result.ok === false) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        // Square icon-only on mobile, icon+label from sm: up. Always
        // visible because of `shrink-0` — without it the badge-laden
        // h1 next to it would push the button to the next line and
        // (on cramped mobile screens) below the fold.
        aria-label={t("trips.editTrip")}
        title={t("trips.editTrip")}
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-[12px] soft-raised-sm hover:bg-(--background) text-sm font-medium transition"
      >
        <JtIcon name="pencil" size={18} />
        <span className="hidden sm:inline">{t("trips.editTrip")}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,440px)] max-h-[85vh] overflow-y-auto rounded-2xl soft-raised-sm shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">{t("trips.editTrip")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-(--muted) hover:bg-(--background)"
                aria-label="close"
              >
                <JtIcon name="x" size={22} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("trips.namePlaceholder")}
                className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
              />

              <div>
                <div className="text-xs text-(--muted) mb-1.5">
                  {t("trips.iconLabel")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_CHOICES.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={cn(
                        "h-9 w-9 rounded-lg border flex items-center justify-center transition",
                        icon === ic
                          ? "border-(--accent) bg-(--accent)/10"
                          : "border-(--border) bg-(--background) hover:bg-(--card)"
                      )}
                    >
                      <JtIcon name={ic} size={26} />
                    </button>
                  ))}
                </div>
                {!ICON_CHOICES.includes(icon as IconName) && icon && (
                  <div className="mt-2 inline-flex items-center gap-2 text-xs text-(--muted)">
                    <EmojiOrIcon value={icon} size={22} />
                    <span>(legacy emoji)</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-(--muted) mb-1.5">
                  {t("trips.colorLabel")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={c}
                      style={{ backgroundColor: c }}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition",
                        color === c
                          ? "border-(--foreground)"
                          : "border-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-(--muted) mb-1.5">
                  {t("trips.currencyLabel")}
                </div>
                <CurrencyPicker
                  value={currency}
                  onChange={setCurrency}
                  ariaLabel={t("trips.currencyLabel")}
                />
                <p className="text-xs text-(--muted) mt-1">
                  {t("trips.currencyEditHint")}
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 px-4 py-2.5 rounded-[16px] soft-raised hover:bg-(--background) text-sm font-medium disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || !name.trim()}
                  className="flex-[2] px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
                >
                  {pending ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
