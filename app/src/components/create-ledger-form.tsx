"use client";

import { useState, useTransition } from "react";
import { JtIcon, type IconName } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createSharedLedgerAction } from "@/app/(app)/ledgers/actions";
import { cn } from "@/lib/utils";

// Shared-ledger themes. Original set had 💕 and 🐶 emoji we don't have
// JtIcon equivalents for; replaced with ring (couples) and skipped pet.
const ICONS: IconName[] = [
  "users",
  "house",
  "airplane",
  "ring",
  "ramen",
  "party",
  "gift",
  "books",
  "shopping-cart",
  "money-bag",
];
const DEFAULT_LEDGER_ICON: IconName = "users";
const COLORS = [
  "#a855f7", "#ec4899", "#3b82f6", "#10b981",
  "#f59e0b", "#06b6d4", "#84cc16", "#ef4444",
];

export function CreateLedgerForm() {
  const router = useRouter();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName>(DEFAULT_LEDGER_ICON);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-(--border) bg-(--card)/30 hover:bg-(--card) hover:border-(--accent) px-4 py-5 text-(--muted) hover:text-(--foreground) transition font-medium"
      >
        <JtIcon name="plus-fab" size={22} />
        {t("ledgers.createNew")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const fd = new FormData();
        fd.set("name", name);
        fd.set("icon", icon);
        fd.set("color", color);
        startTransition(async () => {
          const result = await createSharedLedgerAction(fd);
          if (result?.ok === false) setError(result.error);
          else router.refresh();
        });
      }}
      className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-4"
    >
      <div>
        <h3 className="font-semibold mb-1">{t("ledgers.createFormTitle")}</h3>
        <p className="text-xs text-(--muted)">{t("ledgers.createFormSubtitle")}</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t("ledgers.ledgerName")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("ledgers.ledgerNamePlaceholder")}
          maxLength={50}
          autoFocus
          className="w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--background) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t("ledgers.icon")}</label>
        <div className="flex flex-wrap gap-2">
          {ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={cn(
                "h-10 w-10 rounded-lg border flex items-center justify-center transition",
                icon === i
                  ? "border-(--accent) bg-(--accent)/10"
                  : "border-(--border) hover:bg-(--background)"
              )}
            >
              <JtIcon name={i} size={26} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t("ledgers.color")}</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition",
                color === c ? "border-(--foreground) scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-(--expense)">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="flex-1 px-4 py-2.5 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="flex-[2] px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50"
        >
          {pending ? t("common.creating") : t("ledgers.createSubmit")}
        </button>
      </div>
    </form>
  );
}
