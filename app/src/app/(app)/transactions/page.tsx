import Link from "next/link";
import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { listCategories } from "@/lib/categories";
import { JtIcon } from "@/components/icons";
import { TransactionList } from "@/components/transaction-list";
import { TransactionsHeader } from "@/components/transactions-header";
import { TransactionsHero } from "@/components/transactions-hero";
import { CategoryFilterPills } from "@/components/category-filter-pills";
import { resolveRange } from "@/lib/date-range";
import { nowInBusinessTz } from "@/lib/business-tz";
import { intlLocale } from "@/lib/locale-format";
import { getLocale, getTranslations } from "next-intl/server";

import type { TxKind } from "@/lib/types";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [sp, { ledgerId, ledger }, t, locale] = await Promise.all([
    searchParams,
    requireSession(),
    getTranslations(),
    getLocale(),
  ]);
  const fmtLocale = intlLocale(locale);
  const isShared = !ledger.is_personal;
  const currency = ledger.currency;

  // Month switcher state. When `ym` is present (or `range` is absent),
  // we render the prev / next chevrons and filter to that month — same
  // UX as the report page. `range` is still honoured when set explicitly
  // (legacy entry points like the heatmap pass `range=all&from=…`).
  const ymNow = nowInBusinessTz();
  const ymFallback = `${ymNow.getUTCFullYear()}-${String(
    ymNow.getUTCMonth() + 1
  ).padStart(2, "0")}`;
  const ymRaw =
    sp.ym && /^\d{4}-\d{2}$/.test(sp.ym) ? sp.ym : sp.range ? null : ymFallback;
  const ymActive = ymRaw !== null;
  const [ymYear, ymMonth] = ymActive
    ? ymRaw!.split("-").map(Number)
    : [ymNow.getUTCFullYear(), ymNow.getUTCMonth() + 1];

  // Bounds: if a month is active, use the same UTC bounds the report
  // page uses for the matching `ym`. Otherwise fall back to the legacy
  // `range` resolver so existing entry points keep working.
  const range = ymActive
    ? {
        from: new Date(Date.UTC(ymYear, ymMonth - 1, 1)).toISOString(),
        to: new Date(Date.UTC(ymYear, ymMonth, 1)).toISOString(),
        key: "month" as const,
      }
    : resolveRange(sp.range);

  const kindParam =
    sp.kind === "income" || sp.kind === "expense" ? (sp.kind as TxKind) : undefined;

  const tripParam = sp.trip;
  const tripFilter =
    tripParam === "none" ? null : tripParam || undefined;

  const searchQ = sp.q?.trim() || undefined;

  // Categories are needed for both the filter pills AND to expand a
  // picked parent into "parent + its subs" before querying. We fetch
  // them first then derive the id list, so a tap on อาหาร surfaces
  // คาเฟ่ / ของหวาน rows too instead of just rows tagged with the
  // bare parent id.
  const categories = await listCategories(ledgerId);
  const picked = sp.category;
  let categoryIds: string[] | undefined;
  if (picked) {
    const selected = categories.find((c) => c.id === picked);
    if (selected && selected.parent_id === null) {
      const subs = categories
        .filter((c) => c.parent_id === selected.id)
        .map((c) => c.id);
      categoryIds = [selected.id, ...subs];
    } else {
      // Sub-category picked, or unknown id (deleted?) — match exact only.
      categoryIds = [picked];
    }
  }
  const items = await listTransactions({
    ledgerId,
    from: range.from,
    to: range.to,
    kind: kindParam,
    categoryIds,
    tripId: tripFilter as string | null | undefined,
    search: searchQ,
    limit: 500,
  });

  const totalIncome = items
    .filter((tx) => tx.kind === "income")
    .reduce((s, tx) => s + tx.amount, 0);
  const totalExpense = items
    .filter((tx) => tx.kind === "expense")
    .reduce((s, tx) => s + tx.amount, 0);

  // Build prev / next month links while preserving every other active
  // filter (q, category, kind, trip…). The switcher always speaks `ym`
  // — clicking prev/next drops `range` from the URL so the navigation
  // stays month-by-month from then on.
  const prevYm =
    ymMonth === 1
      ? `${ymYear - 1}-12`
      : `${ymYear}-${String(ymMonth - 1).padStart(2, "0")}`;
  const nextYm =
    ymMonth === 12
      ? `${ymYear + 1}-01`
      : `${ymYear}-${String(ymMonth + 1).padStart(2, "0")}`;
  function buildLink(ym: string) {
    const params = new URLSearchParams();
    params.set("ym", ym);
    if (sp.q) params.set("q", sp.q);
    if (sp.category) params.set("category", sp.category);
    if (sp.kind) params.set("kind", sp.kind);
    if (sp.trip) params.set("trip", sp.trip);
    return `/transactions?${params.toString()}`;
  }
  const monthLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "long",
    year: "numeric",
  }).format(new Date(ymYear, ymMonth - 1, 1));

  return (
    <div className="space-y-4">
      <TransactionsHeader title={t("transactions.title")} />

      {/* Month switcher — mirrors /reports so the user can scrub through
          months from this list without bouncing between pages. Hidden
          when a non-month `range` is explicitly active (legacy heatmap
          link etc.) so the switcher's label doesn't lie about what's
          being shown. */}
      {ymActive && (
        <div className="rounded-[22px] soft-raised flex items-center justify-between px-3 py-2">
          <Link
            href={buildLink(prevYm)}
            aria-label={t("calendar.prev")}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-(--background) transition"
          >
            <JtIcon name="chevron-left" size={20} />
          </Link>
          <span className="font-semibold tabular-nums">{monthLabel}</span>
          <Link
            href={buildLink(nextYm)}
            aria-label={t("calendar.next")}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-(--background) transition"
          >
            <JtIcon name="chevron-right" size={20} />
          </Link>
        </div>
      )}

      <TransactionsHero
        count={items.length}
        income={totalIncome}
        expense={totalExpense}
        currency={currency}
        fmtLocale={fmtLocale}
      />

      <CategoryFilterPills categories={categories} />

      <TransactionList
        items={items}
        showAttribution={isShared}
        currency={currency}
        highlight={searchQ}
      />
    </div>
  );
}
