"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2, Play, Pause, RefreshCw } from "lucide-react";
import type { Category, TxKind } from "@/lib/types";
import type { RecurPeriod, RecurringRule } from "@/lib/recurring";
import {
  createRecurringAction,
  deleteRecurringAction,
  runDueAction,
  toggleRecurringAction,
} from "@/app/(app)/recurring/actions";
import { formatCurrency, formatDate, cn, toLocalDateTimeInput } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

export function RecurringPanel({
  rules,
  categories,
}: {
  rules: RecurringRule[];
  categories: Category[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(rules.length === 0);

  function applyDue() {
    startTransition(async () => {
      const result = await runDueAction();
      router.refresh();
      if (result.created > 0) {
        alert(t("recurring.runDueResultCreated", { count: result.created }));
      } else {
        alert(t("recurring.runDueResultEmpty"));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2.5 text-sm font-medium transition"
        >
          <Plus size={16} />
          {t("recurring.addButton")}
        </button>
        <button
          type="button"
          onClick={applyDue}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
          {t("recurring.runDue")}
        </button>
      </div>

      {showForm && (
        <CreateRecurringForm
          categories={categories}
          onDone={() => setShowForm(false)}
        />
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-(--muted) px-1">{t("recurring.empty")}</p>
      ) : (
        <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} pending={pending} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateRecurringForm({
  categories,
  onDone,
}: {
  categories: Category[];
  onDone: () => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<TxKind>("expense");
  const [period, setPeriod] = useState<RecurPeriod>("monthly");
  const [error, setError] = useState<string | null>(null);
  const visibleCats = categories.filter((c) => c.kind === kind);

  // datetime-local must be initialised on the client (browser TZ). Computing
  // it on the server would emit the value formatted in UTC, which the user's
  // browser then displays verbatim as if it were local — off by the user's
  // UTC offset. See transaction-form.tsx for the longer write-up.
  const startRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = startRef.current;
    if (!el) return;
    el.value = toLocalDateTimeInput(new Date(Date.now() + 60_000));
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("kind", kind);
        fd.set("period", period);
        // Convert TZ-naive "wall clock" string to UTC ISO so the server-side
        // `new Date(str)` parse doesn't reinterpret it in UTC.
        const startRaw = fd.get("startDate");
        if (typeof startRaw === "string" && startRaw.length > 0) {
          const inst = new Date(startRaw);
          if (!Number.isNaN(inst.getTime())) {
            fd.set("startDate", inst.toISOString());
          }
        }
        startTransition(async () => {
          const result = await createRecurringAction(fd);
          if (result?.ok === false) setError(result.error);
          else {
            router.refresh();
            onDone();
          }
        });
      }}
      className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-4"
    >
      <div className="grid grid-cols-2 gap-2 p-1 bg-(--background) rounded-xl">
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={cn(
            "py-2 rounded-lg text-sm font-medium transition",
            kind === "expense"
              ? "bg-(--expense) text-white"
              : "text-(--muted)"
          )}
        >
          {t("transactions.kindToggleExpense")}
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={cn(
            "py-2 rounded-lg text-sm font-medium transition",
            kind === "income" ? "bg-(--income) text-white" : "text-(--muted)"
          )}
        >
          {t("transactions.kindToggleIncome")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted)">
            {t("common.amountTHB")}
          </label>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted)">
            {t("recurring.frequency")}
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as RecurPeriod)}
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
          >
            <option value="monthly">{t("recurring.frequencyMonthly")}</option>
            <option value="weekly">{t("recurring.frequencyWeekly")}</option>
            <option value="daily">{t("recurring.frequencyDaily")}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 text-(--muted)">
          {t("recurring.categoryLabel")}
        </label>
        <select
          name="categoryId"
          required
          className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
        >
          <option value="">{t("recurring.selectCategory")}</option>
          {visibleCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 text-(--muted)">
          {t("recurring.startDate")}
        </label>
        <input
          ref={startRef}
          name="startDate"
          type="datetime-local"
          required
          // No defaultValue — see useEffect; SSR-rendered TZ would mislead
          // the user. The effect fills in `now + 1 min` in their browser TZ.
          suppressHydrationWarning
          className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 text-(--muted)">
          {t("common.noteOptional")}
        </label>
        <input
          name="note"
          type="text"
          maxLength={500}
          placeholder={t("recurring.notePlaceholder")}
          className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
        />
      </div>

      {error && <p className="text-sm text-(--expense)">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--card) text-sm"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-[2] px-3 py-2 rounded-lg bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50"
        >
          {pending ? t("common.creating") : t("recurring.createButton")}
        </button>
      </div>
    </form>
  );
}

function RuleRow({ rule, pending }: { rule: RecurringRule; pending: boolean }) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [busy, startTransition] = useTransition();
  const PERIOD_LABEL: Record<RecurPeriod, string> = {
    daily: t("recurring.frequencyDaily"),
    weekly: t("recurring.frequencyWeekly"),
    monthly: t("recurring.frequencyMonthly"),
  };

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition",
        !rule.active && "opacity-60"
      )}
    >
      <span className="text-2xl">{rule.category?.icon ?? "✨"}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {rule.category?.name ?? t("common.uncategorizedFull")}
        </div>
        <div className="text-xs text-(--muted) flex items-center gap-2 flex-wrap">
          <span>{PERIOD_LABEL[rule.period]}</span>
          <span>•</span>
          <span>
            {t("recurring.nextRun", { when: formatDate(rule.next_run_at, fmtLocale) })}
          </span>
          {rule.note && (
            <>
              <span>•</span>
              <span className="truncate">{rule.note}</span>
            </>
          )}
        </div>
      </div>
      <div
        className={`tabular-nums font-semibold ${
          rule.kind === "income" ? "text-(--income)" : "text-(--expense)"
        }`}
      >
        {rule.kind === "income" ? "+" : "−"}
        {formatCurrency(rule.amount, "THB", fmtLocale)}
      </div>
      <button
        type="button"
        disabled={pending || busy}
        onClick={() =>
          startTransition(async () => {
            await toggleRecurringAction(rule.id, !rule.active);
            router.refresh();
          })
        }
        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
        aria-label={rule.active ? t("common.cancel") : t("common.confirm")}
      >
        {rule.active ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        type="button"
        disabled={pending || busy}
        onClick={() => {
          if (!confirm(t("recurring.deleteConfirm"))) return;
          startTransition(async () => {
            await deleteRecurringAction(rule.id);
            router.refresh();
          });
        }}
        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
        aria-label={t("common.delete")}
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
