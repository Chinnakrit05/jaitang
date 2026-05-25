"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";

/**
 * Transactions list page header. Renders the page title and a circular
 * search trigger; tapping the trigger swaps the title for a debounced
 * search field that pushes `?q=` into the URL. The toggle mirrors the
 * mobile UX in the Figma mockup — search is hidden behind the icon so
 * the hero card stays uncluttered.
 */
export function TransactionsHeader({ title }: { title: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations();
  const [, startTransition] = useTransition();

  const initialQ = params.get("q") ?? "";
  const [open, setOpen] = useState(initialQ.length > 0);
  const [value, setValue] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (value === initialQ) return;
    const id = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (value.trim()) sp.set("q", value.trim());
      else sp.delete("q");
      const qs = sp.toString();
      startTransition(() => router.push(`/transactions${qs ? `?${qs}` : ""}`));
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function close() {
    setValue("");
    setOpen(false);
    if (params.get("q")) {
      const sp = new URLSearchParams(params.toString());
      sp.delete("q");
      const qs = sp.toString();
      startTransition(() => router.push(`/transactions${qs ? `?${qs}` : ""}`));
    }
  }

  if (open) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <JtIcon
            name="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-(--muted) pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("transactions.filters.searchPlaceholder")}
            className="w-full pl-9 pr-3 py-2.5 rounded-full border border-(--border) bg-(--card) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
          />
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("common.cancel")}
          className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-(--muted) hover:text-(--foreground) hover:bg-(--card)"
        >
          <JtIcon name="x" size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold truncate">{title}</h1>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("transactions.searchAria")}
        className="shrink-0 h-10 w-10 rounded-full bg-(--card) border border-(--border) flex items-center justify-center text-(--foreground) hover:bg-(--background) transition"
      >
        <JtIcon name="search" size={20} />
      </button>
    </div>
  );
}
