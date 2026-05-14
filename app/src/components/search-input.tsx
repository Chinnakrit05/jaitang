"use client";

import { useEffect, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Debounced search input that pushes `?q=` into the URL on a 300 ms
 * idle timer. Lives in its own component so the parent filter strip
 * can stay a thin server-driven layout.
 *
 * The controlled `value` is local state; we don't read directly from
 * `searchParams` for typing because every keystroke would trigger a
 * server round-trip.
 */
export function SearchInput({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);

  // Sync local state when navigation happens (e.g. user clears via
  // "Clear filters" button) so the input reflects URL truth. We accept
  // the cascading-render lint warning here — reading `params.get("q")`
  // directly during render would bypass our debounced controlled input,
  // and a re-mount-on-key approach flickers while the user is typing.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initial);
  }, [initial]);

  // Debounce: wait until the user stops typing for 300 ms, then push.
  useEffect(() => {
    if (value === initial) return;
    const t = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (value.trim()) sp.set("q", value.trim());
      else sp.delete("q");
      const qs = sp.toString();
      startTransition(() =>
        router.push(`/transactions${qs ? `?${qs}` : ""}`)
      );
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <JtIcon
        name="search"
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-(--muted) pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-(--border) bg-(--card) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)/40"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-(--muted) hover:text-(--foreground)"
          aria-label="clear"
        >
          <JtIcon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
