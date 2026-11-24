import { getTranslations } from "next-intl/server";
import { JtIcon } from "@/components/icons";
import type { ChangeSummary } from "@/lib/change-log";
import { formatCurrency } from "@/lib/utils";

export type HistoryItem = {
  id: number;
  /** "24 พ.ย. 23:24", already in Bangkok time. */
  when: string;
  /** The row the change was made to: its category for a recurring month,
   *  its note (or category) for an ordinary transaction. */
  title: string;
  summary: ChangeSummary;
  actor: string | null;
  via: string | null;
};

/** Screens the app tags writes with (audit-context.ts → AuditVia). One
 *  it doesn't know reads as "unknown" rather than as a raw code. */
const KNOWN_VIA = new Set([
  "form",
  "quick",
  "reports",
  "scan",
  "import",
  "recurring",
  "restore",
  "wipe",
  "recategorize",
  "trip",
]);

/**
 * What changed this month, newest first — the answer to "what did this
 * say before?", which the page alone can't give: every amount on it is
 * edited in place.
 *
 * Folded shut by default. It's for the odd time a number looks wrong,
 * not for reading every month, and the page above it is already long.
 */
export async function MonthHistory({
  items,
  truncated,
  currency,
  fmtLocale,
}: {
  items: HistoryItem[];
  truncated: boolean;
  currency: string;
  fmtLocale: string;
}) {
  if (items.length === 0) return null;
  const t = await getTranslations("history");

  const money = (v: number | null) =>
    v === null ? "-" : formatCurrency(v, currency, fmtLocale);

  function describe(s: ChangeSummary): string {
    switch (s.kind) {
      case "added":
        return t("added", { amount: money(s.amount) });
      case "amount":
        return `${money(s.from)} → ${money(s.to)}`;
      case "deleted":
        return t("deleted", { amount: money(s.amount) });
      case "restored":
        return t("restored", { amount: money(s.amount) });
      case "edited":
        return t("edited", {
          fields: s.fields.map((f) => t(`field.${f}`)).join(", "),
        });
    }
  }

  return (
    <details className="group rounded-[22px] soft-raised overflow-hidden">
      <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <JtIcon name="history" size={16} />
          {t("title")}
        </span>
        <span className="flex items-center gap-1 text-xs text-(--muted) tabular-nums">
          {t("count", { count: items.length })}
          <JtIcon
            name="chevron-down"
            size={14}
            className="transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <ol className="divide-y divide-(--soft-shade)/45 border-t border-(--soft-shade)/45">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm">{item.title}</span>
              <span className="shrink-0 text-sm tabular-nums">{describe(item.summary)}</span>
            </div>
            <p className="text-[11px] text-(--muted) leading-tight">
              {[
                item.when,
                t(`via.${item.via && KNOWN_VIA.has(item.via) ? item.via : "unknown"}`),
                item.actor,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ol>
      {truncated && (
        <p className="px-4 py-2 text-[11px] text-(--muted) border-t border-(--soft-shade)/45">
          {t("truncated", { count: items.length })}
        </p>
      )}
    </details>
  );
}
