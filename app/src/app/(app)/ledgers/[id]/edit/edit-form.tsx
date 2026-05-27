"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { JtIcon, EmojiOrIcon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

// Same curated icon set the create form uses, kept here so the
// pages drift together when we add new options later.
const ICON_PRESETS: IconName[] = [
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

// Quick emoji shortcuts — the icon column accepts either a JtIcon
// name or a raw emoji string (EmojiOrIcon branches at render time).
const EMOJI_PRESETS = [
  "📒", "💰", "🏠", "👨‍👩‍👧", "🐶", "🐱",
  "✈️", "🛍️", "🎉", "🎁", "📚", "💳",
];

type PayPref = "cash" | "transfer" | null;

export function EditLedgerForm({
  ledgerId,
  initialName,
  initialIcon,
  initialDefaultPaymentMethod,
  action,
}: {
  ledgerId: string;
  initialName: string;
  initialIcon: string | null;
  initialDefaultPaymentMethod: PayPref;
  action: (patch: {
    name?: string;
    icon?: string | null;
    defaultPaymentMethod?: PayPref;
  }) => Promise<Result>;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string>(initialIcon ?? "users");
  const [payPref, setPayPref] = useState<PayPref>(initialDefaultPaymentMethod);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError(t("ledgers.nameLabel"));
      return;
    }
    startTransition(async () => {
      const result = await action({
        name: trimmed,
        icon,
        defaultPaymentMethod: payPref,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      router.push("/ledgers");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Preview card so the user can see exactly how the row will
          read on /ledgers as they edit. */}
      <div className="rounded-2xl border border-(--border) bg-(--card) p-4 flex items-center gap-3">
        <EmojiOrIcon value={icon} fallback="users" size={32} />
        <div className="font-semibold truncate">
          {name.trim() || initialName}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("ledgers.nameLabel")}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--background) focus:outline-none focus:ring-2 focus:ring-(--accent)/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("ledgers.iconLabel")}
        </label>
        <div className="rounded-xl border border-(--border) bg-(--background)/40 p-2 space-y-3">
          <div>
            <p className="text-[11px] text-(--muted) mb-1.5">
              {t("categories.iconTab")}
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
              {ICON_PRESETS.map((name) => {
                const isActive = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    aria-pressed={isActive}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center transition",
                      isActive
                        ? "bg-(--accent)/15 ring-2 ring-(--accent)/50"
                        : "hover:bg-(--card)"
                    )}
                  >
                    <JtIcon name={name} size={24} />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-(--muted) mb-1.5">
              {t("categories.emojiTab")}
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {EMOJI_PRESETS.map((e) => {
                const isActive = icon === e;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcon(e)}
                    aria-pressed={isActive}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-xl leading-none transition",
                      isActive
                        ? "bg-(--accent)/15 ring-2 ring-(--accent)/50"
                        : "hover:bg-(--card)"
                    )}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("ledgers.defaultPaymentLabel")}
        </label>
        <p className="text-[11px] text-(--muted) mb-2">
          {t("ledgers.defaultPaymentHint")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <PayChoice
            label={t("ledgers.defaultPaymentNone")}
            icon="—"
            selected={payPref === null}
            onClick={() => setPayPref(null)}
          />
          <PayChoice
            label={t("transactions.paymentCash")}
            icon="💵"
            selected={payPref === "cash"}
            onClick={() => setPayPref("cash")}
          />
          <PayChoice
            label={t("transactions.paymentTransfer")}
            icon="💳"
            selected={payPref === "transfer"}
            onClick={() => setPayPref("transfer")}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link
          href="/ledgers"
          className="flex-1 px-3 py-2.5 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium text-center"
        >
          {t("common.cancel")}
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex-[2] inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50"
        >
          {pending ? (
            <JtIcon name="loader-2" size={18} className="animate-spin" />
          ) : (
            <JtIcon name="check" size={18} />
          )}
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
      {/* Suppress the unused ledgerId warning while keeping the prop
          for future use (audit log / debug links). */}
      <span hidden>{ledgerId}</span>
    </div>
  );
}

function PayChoice({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border text-sm font-medium transition",
        selected
          ? "border-(--accent) bg-(--accent)/10 text-(--accent)"
          : "border-(--border) bg-(--card) hover:bg-(--background)"
      )}
    >
      <span aria-hidden className="text-lg leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
