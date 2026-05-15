"use client";

import { useMemo, useState, useTransition } from "react";
import { JtIcon, iconNameToEmoji } from "@/components/icons";
import { sortByHierarchy } from "@/lib/categories";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import {
  applyImportAction,
  parseImportAction,
  type ImportPreview,
  type PreviewRow,
} from "@/app/(app)/import/actions";
import { formatCurrency, yearMonthInTz } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

type Step = "upload" | "preview" | "done";

export function ImportWizard({ ledgerCurrency }: { ledgerCurrency: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [createdCount, setCreatedCount] = useState(0);

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await parseImportAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result);
      setRows(result.rows);
      setStep("preview");
    });
  }

  function applyAll() {
    setError(null);
    startTransition(async () => {
      const result = await applyImportAction({ rows });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreatedCount(result.created);
      setStep("done");
      router.refresh();
    });
  }

  function patchRow(id: string, patch: Partial<PreviewRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl border border-(--income)/40 bg-(--income)/5 p-8 text-center space-y-4">
        <JtIcon name="check-circle-2" size={48} className="text-(--income) mx-auto" />
        <div>
          <h2 className="text-xl font-bold">{t("import.doneTitle")}</h2>
          <p className="text-(--muted) mt-1">
            {t("import.doneBody", { count: createdCount })}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStep("upload");
              setPreview(null);
              setRows([]);
              setCreatedCount(0);
            }}
            className="px-4 py-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm"
          >
            {t("import.uploadAnother")}
          </button>
          <a
            href="/transactions"
            className="px-4 py-2 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold"
          >
            {t("import.viewTransactions")}
          </a>
        </div>
      </div>
    );
  }

  if (step === "preview" && preview) {
    return (
      <PreviewStep
        preview={preview}
        rows={rows}
        currency={ledgerCurrency}
        fmtLocale={fmtLocale}
        pending={pending}
        error={error}
        onPatch={patchRow}
        onRemove={removeRow}
        onCancel={() => {
          setStep("upload");
          setPreview(null);
          setRows([]);
          setError(null);
        }}
        onApply={applyAll}
      />
    );
  }

  // upload step
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-dashed border-(--border) bg-(--card)/50 p-10 text-center">
        <JtIcon name="upload" size={36} className="text-(--muted) mx-auto mb-3" />
        <h2 className="font-semibold mb-1">{t("import.dropTitle")}</h2>
        <p className="text-sm text-(--muted) mb-4">{t("import.dropHint")}</p>
        <label className="inline-flex items-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) px-5 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50">
          {pending ? (
            <>
              <JtIcon name="loader-2" size={20} className="animate-spin" />
              {t("import.processing")}
            </>
          ) : (
            <>
              <JtIcon name="upload" size={20} />
              {t("import.chooseFile")}
            </>
          )}
          <input
            type="file"
            accept=".zip,.csv,application/zip,text/csv"
            className="hidden"
            disabled={pending}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="text-xs text-(--muted) px-1 space-y-1">
        <p>{t("import.aiHint")}</p>
        <p>{t("import.formatHint")}</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-(--expense)/40 bg-(--expense)/5 p-4 flex items-start gap-3">
          <JtIcon name="alert-circle" size={24} className="text-(--expense) shrink-0 mt-0.5" />
          <div className="text-sm text-(--expense)">{error}</div>
        </div>
      )}
    </div>
  );
}

function PreviewStep({
  preview,
  rows,
  currency,
  fmtLocale,
  pending,
  error,
  onPatch,
  onRemove,
  onCancel,
  onApply,
}: {
  preview: ImportPreview;
  rows: PreviewRow[];
  currency: string;
  fmtLocale: string;
  pending: boolean;
  error: string | null;
  onPatch: (id: string, patch: Partial<PreviewRow>) => void;
  onRemove: (id: string) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const t = useTranslations();

  // Group rows by month for the summary. Use the BROWSER's TZ (no `tz`
  // arg) so the bucket label matches the per-row date label below — both
  // run on the client and should agree. Previously this used UTC, which
  // split late-night rows into the wrong month.
  const monthSummary = useMemo(() => {
    const map = new Map<
      string,
      { year: number; month: number; income: number; expense: number; count: number }
    >();
    for (const r of rows) {
      const { year, month } = yearMonthInTz(r.occurredAt);
      const key = `${year}-${month}`;
      const cur = map.get(key) ?? { year, month, income: 0, expense: 0, count: 0 };
      if (r.kind === "income") cur.income += r.amount;
      else cur.expense += r.amount;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
  }, [rows]);

  // Stats
  const totalRows = rows.length;
  const newCategories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (!r.categoryId && r.newCategoryName) {
        set.add(`${r.kind}:${r.newCategoryName}`);
      }
    }
    return set.size;
  }, [rows]);

  // Trip stats — how many incoming rows referenced a trip and how many of
  // those landed on a real trip in the destination. Surfacing the gap
  // helps users notice "I forgot to recreate ทริปทะเล first".
  const tripStats = useMemo(() => {
    let withTripName = 0;
    let matched = 0;
    const unmatchedNames = new Set<string>();
    for (const r of rows) {
      if (!r.tripName) continue;
      withTripName++;
      if (r.tripId) matched++;
      else unmatchedNames.add(r.tripName);
    }
    return {
      withTripName,
      matched,
      unmatched: withTripName - matched,
      unmatchedNames: Array.from(unmatchedNames),
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label={t("import.statRows")} value={String(totalRows)} />
        <Stat
          label={t("import.statMonths")}
          value={String(monthSummary.length)}
        />
        <Stat
          label={t("import.statNewCategories")}
          value={String(newCategories)}
        />
      </div>

      {tripStats.withTripName > 0 && (
        <div className="rounded-2xl border border-(--border) bg-(--card) p-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {t("import.tripsTitle")}
            </span>
            <span className="text-xs text-(--muted) tabular-nums">
              {t("import.tripsMatched", {
                matched: tripStats.matched,
                total: tripStats.withTripName,
              })}
            </span>
          </div>
          {tripStats.unmatched > 0 && (
            <div className="text-xs text-(--muted)">
              {t("import.tripsUnmatched")}{" "}
              <span className="text-(--foreground)">
                {tripStats.unmatchedNames.join(", ")}
              </span>{" "}
              <span className="text-(--muted)">
                — {t("import.tripsUnmatchedHint")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Month breakdown */}
      <div className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-2">
        <h3 className="font-semibold text-sm">{t("import.byMonth")}</h3>
        <ul className="text-sm divide-y divide-(--border)">
          {monthSummary.map((m) => (
            <li
              key={`${m.year}-${m.month}`}
              className="flex items-center justify-between py-1.5"
            >
              <span>
                {new Intl.DateTimeFormat(fmtLocale, {
                  month: "long",
                  year: "numeric",
                }).format(new Date(m.year, m.month - 1, 1))}
              </span>
              <span className="text-(--muted) text-xs tabular-nums">
                {m.count} {t("import.itemsShort")} •{" "}
                {m.income > 0 && (
                  <span className="text-(--income)">
                    +{formatCurrency(m.income, currency, fmtLocale)}{" "}
                  </span>
                )}
                {m.expense > 0 && (
                  <span className="text-(--expense)">
                    −{formatCurrency(m.expense, currency, fmtLocale)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Rows */}
      <div className="rounded-2xl border border-(--border) bg-(--card) overflow-hidden">
        <div className="px-4 py-2.5 border-b border-(--border) text-sm font-semibold flex items-center gap-2">
          <JtIcon name="sparkles" size={18} className="text-(--accent)" />
          {t("import.previewTitle")}
        </div>
        <ul className="divide-y divide-(--border) max-h-[480px] overflow-y-auto">
          {rows.map((r) => (
            <RowEditor
              key={r.id}
              row={r}
              currency={currency}
              fmtLocale={fmtLocale}
              categories={preview.knownCategories}
              onPatch={(p) => onPatch(r.id, p)}
              onRemove={() => onRemove(r.id)}
            />
          ))}
        </ul>
      </div>

      {error && (
        <div className="rounded-2xl border border-(--expense)/40 bg-(--expense)/5 p-4 flex items-start gap-3">
          <JtIcon name="alert-circle" size={24} className="text-(--expense) shrink-0 mt-0.5" />
          <div className="text-sm text-(--expense)">{error}</div>
        </div>
      )}

      <div className="flex gap-2 sticky bottom-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="flex-1 px-4 py-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={pending || rows.length === 0}
          className="flex-[2] px-4 py-3 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <JtIcon name="loader-2" size={20} className="animate-spin" />
              {t("import.applying")}
            </>
          ) : (
            t("import.applyAll", { count: rows.length })
          )}
        </button>
      </div>
    </div>
  );
}

function RowEditor({
  row,
  currency,
  fmtLocale,
  categories,
  onPatch,
  onRemove,
}: {
  row: PreviewRow;
  currency: string;
  fmtLocale: string;
  categories: ImportPreview["knownCategories"];
  onPatch: (patch: Partial<PreviewRow>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations();
  const visible = sortByHierarchy(
    categories.filter((c) => c.kind === row.kind),
  );
  const d = new Date(row.occurredAt);
  const dateLabel = new Intl.DateTimeFormat(fmtLocale, {
    month: "short",
    year: "numeric",
  }).format(d);

  function handleSelect(value: string) {
    if (value === "__new__") {
      onPatch({
        categoryId: null,
        newCategoryName: row.newCategoryName ?? "ใหม่",
        newCategoryIcon: row.newCategoryIcon ?? "✨",
      });
      return;
    }
    onPatch({ categoryId: value, newCategoryName: null, newCategoryIcon: null });
  }

  const selectValue = row.categoryId
    ? row.categoryId
    : row.newCategoryName
    ? "__new__"
    : "";

  return (
    <li className="px-3 py-2.5 hover:bg-(--background) transition flex items-center gap-2 text-sm">
      <span className="text-xs text-(--muted) w-16 shrink-0">{dateLabel}</span>

      <span
        className={`tabular-nums font-semibold w-20 text-right shrink-0 ${
          row.kind === "income" ? "text-(--income)" : "text-(--expense)"
        }`}
      >
        {row.kind === "income" ? "+" : "−"}
        {formatCurrency(row.amount, currency, fmtLocale)}
      </span>

      <span className="flex-1 min-w-0 truncate flex items-center gap-1.5">
        <span className="truncate">{row.note}</span>
        {row.tripName && (
          <span
            className={
              row.tripId
                ? "shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-(--accent)/40 bg-(--accent)/10 text-(--foreground)"
                : "shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-(--muted)/30 bg-(--muted)/10 text-(--muted)"
            }
            title={
              row.tripId
                ? t("import.tripBadgeMatched")
                : t("import.tripBadgeUnmatched")
            }
          >
            ✈️ {row.tripName}
          </span>
        )}
      </span>

      <select
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        className="px-2 py-1 rounded-lg border border-(--border) bg-(--card) text-xs max-w-[180px]"
      >
        <option value="" disabled>
          —
        </option>
        {visible.map((c) => (
          <option key={c.id} value={c.id}>
            {c.parent_id ? "  ↳ " : ""}
            {iconNameToEmoji(c.icon)} {c.name}
          </option>
        ))}
        <option value="__new__">
          ➕ {row.newCategoryName ?? t("import.newCategory")}
        </option>
      </select>

      {row.newCategoryName && (
        <input
          type="text"
          value={row.newCategoryName}
          onChange={(e) => onPatch({ newCategoryName: e.target.value })}
          maxLength={50}
          className="px-2 py-1 rounded-lg border border-(--accent)/40 bg-(--accent)/5 text-xs w-24"
          placeholder={t("import.newCategoryPh")}
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="text-(--muted) hover:text-(--expense) text-xs px-1"
        aria-label={t("common.delete")}
      >
        ✕
      </button>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--card) p-3">
      <div className="text-xs text-(--muted)">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
