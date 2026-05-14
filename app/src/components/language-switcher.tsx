"use client";

import { useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { setLocaleAction } from "@/app/(app)/settings/locale-action";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const router = useRouter();
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  function pick(loc: Locale) {
    if (loc === current || pending) return;
    startTransition(async () => {
      await setLocaleAction(loc);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <JtIcon name="globe" size={20} className="text-(--muted)" />
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => pick(loc)}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition border",
            current === loc
              ? "border-(--accent) bg-(--accent)/10 text-(--foreground)"
              : "border-(--border) bg-(--card) text-(--muted) hover:text-(--foreground)",
            pending && "opacity-60"
          )}
        >
          {current === loc && <JtIcon name="check" size={18} className="text-(--accent)" />}
          {LOCALE_LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
