"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { JtIcon, EmojiOrIcon, iconNameToEmoji } from "@/components/icons";
import { sortByHierarchy } from "@/lib/categories";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type { Category, TxKind } from "@/lib/types";
import type { RecurPeriod, RecurringRule } from "@/lib/recurring";
import {
  createRecurringAction,
  deleteRecurringAction,
  fillPendingRecurringAmountAction,
  runDueAction,
  toggleRecurringAction,
  updateRecurringAction,
} from "@/app/(app)/recurring/actions";
import { InlineAmount } from "@/app/(app)/reports/inline-amount";
import { CurrencyPicker } from "@/components/currency-picker";
import { SubscriptionStats } from "@/components/subscription-stats";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

export type RecurringAccountChoice = {
  id: string;
  name: string;
  icon: string | null;
  currency: string;
};
export type RecurringTripChoice = {
  id: string;
  name: string;
  icon: string | null;
  currency: string | null;
};

export function RecurringPanel({
  rules,
  categories,
  accounts,
  trips,
  homeCurrency,
}: {
  rules: RecurringRule[];
  categories: Category[];
  accounts: RecurringAccountChoice[];
  trips: RecurringTripChoice[];
  homeCurrency: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  // Default closed even on an empty list — the header + button makes
  // the create affordance obvious, and dropping straight into a long
  // form on a fresh page was disorienting. User taps "+" to open it.
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const editingRule = rules.find((r) => r.id === editingId) ?? null;

  return (
    <div className="space-y-4 max-w-md mx-auto pb-28">
      {/* Mobile header — back / title / + add */}
      <div className="flex items-center justify-between">
        <Link
          href="/more"
          aria-label={t("common.back")}
          className="h-10 w-10 rounded-full bg-(--card) border border-(--border) flex items-center justify-center shadow-sm hover:bg-(--background) transition"
        >
          <JtIcon name="chevron-left" size={18} />
        </Link>
        <h1 className="text-base font-semibold">{t("recurring.title")}</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-label={t("recurring.addButton")}
          className="h-10 w-10 rounded-full flex items-center justify-center text-white shadow-sm transition active:scale-95"
          style={{
            background: "linear-gradient(135deg, var(--peach-strong) 0%, var(--peach-deep) 100%)",
          }}
        >
          <JtIcon name="plus-fab" size={20} />
        </button>
      </div>

      <SubscriptionStats rules={rules} homeCurrency={homeCurrency} />

      {showForm && (
        <CreateRecurringForm
          categories={categories}
          accounts={accounts}
          trips={trips}
          homeCurrency={homeCurrency}
          onDone={() => setShowForm(false)}
        />
      )}

      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/40 py-10 px-6 text-center">
          <p className="text-3xl mb-2" aria-hidden>📒</p>
          <p className="text-sm text-(--muted)">{t("recurring.empty")}</p>
        </div>
      ) : (
        <>
          <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border)/60 overflow-hidden">
            {rules.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                homeCurrency={homeCurrency}
                pending={pending}
                onEdit={() => setEditingId(r.id)}
              />
            ))}
          </ul>
          <p className="text-center text-xs text-(--muted)">
            {t("recurring.listHelper")}
          </p>
        </>
      )}

      {/* Manual "run due" — kept as a quiet text link so power users
          can still kick the cron-like job from the UI. */}
      <div className="text-center">
        <button
          type="button"
          onClick={applyDue}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-xs text-(--muted) hover:text-(--foreground) disabled:opacity-50"
        >
          <JtIcon name="refresh" size={14} className={pending ? "animate-spin" : ""} />
          {t("recurring.runDue")}
        </button>
      </div>

      {editingRule && (
        <EditRecurringModal
          rule={editingRule}
          categories={categories}
          accounts={accounts}
          trips={trips}
          homeCurrency={homeCurrency}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function CreateRecurringForm({
  categories,
  accounts,
  trips,
  homeCurrency,
  onDone,
}: {
  categories: Category[];
  accounts: RecurringAccountChoice[];
  trips: RecurringTripChoice[];
  homeCurrency: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<TxKind>("expense");
  const [period, setPeriod] = useState<RecurPeriod>("monthly");
  const [accountId, setAccountId] = useState<string>("");
  const [tripId, setTripId] = useState<string>("");
  const [currency, setCurrency] = useState(homeCurrency);
  const [error, setError] = useState<string | null>(null);
  // Subs follow their parent in the dropdown so the user reads top-down
  // as a tree even though `<option>` can't render real groups.
  const visibleCats = sortByHierarchy(
    categories.filter((c) => c.kind === kind),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("kind", kind);
        fd.set("period", period);
        if (accountId) fd.set("accountId", accountId);
        if (tripId) fd.set("tripId", tripId);
        if (currency && currency !== homeCurrency) fd.set("fxCurrency", currency);
        // No startDate input on the form — server fills a period-aware
        // default ("this month / this year / this week / today").
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted)">
            {t("recurring.amountLabel", { currency })}
          </label>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder={t("recurring.amountOptional")}
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) tabular-nums"
          />
          <p className="text-[11px] text-(--muted) mt-1">
            {t("recurring.amountHint")}
          </p>
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
            <option value="yearly">{t("recurring.frequencyYearly")}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted)">
            {t("accounts.currencyLabel")}
          </label>
          <CurrencyPicker
            value={currency}
            onChange={setCurrency}
            ariaLabel={t("accounts.currencyLabel")}
          />
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
              {c.parent_id ? "  ↳ " : ""}
              {iconNameToEmoji(c.icon)} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Optional account + trip pinning. Account list is filtered to
          those whose currency matches the rule's currency — same logic
          as TransactionForm. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted) flex items-center gap-1">
            <JtIcon name="accounts" size={16} />
            {t("accounts.accountField")}
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
          >
            <option value="">{t("accounts.noAccount")}</option>
            {accounts
              .filter((a) => a.currency === currency)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.icon ?? "💰") + " " + a.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted) flex items-center gap-1">
            <JtIcon name="trips" size={16} />
            {t("trips.tripField")}
          </label>
          <select
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
          >
            <option value="">{t("trips.noTrip")}</option>
            {trips.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {(tr.icon ?? "✈️") + " " + tr.name}
              </option>
            ))}
          </select>
        </div>
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
          className="flex-[2] px-3 py-2 rounded-lg bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
        >
          {pending ? t("common.creating") : t("recurring.createButton")}
        </button>
      </div>
    </form>
  );
}

function RuleRow({
  rule,
  homeCurrency,
  pending,
  onEdit,
}: {
  rule: RecurringRule;
  homeCurrency: string;
  pending: boolean;
  onEdit: () => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [busy, startTransition] = useTransition();
  const PERIOD_LABEL: Record<RecurPeriod, string> = {
    daily: t("recurring.frequencyDaily"),
    weekly: t("recurring.frequencyWeekly"),
    monthly: t("recurring.frequencyMonthly"),
    yearly: t("recurring.frequencyYearly"),
  };
  const ruleCurrency = rule.fx_currency ?? homeCurrency;

  // "Applied this period" check — true when last_run_at is inside the
  // current calendar bucket for the rule's period. Drives the green
  // checkmark vs. "next run on X" status line.
  const appliedThisPeriod = isAppliedThisPeriod(rule.last_run_at, rule.period);
  const isVariable = rule.amount === null;

  function commitDelete() {
    if (!confirm(t("recurring.deleteConfirm"))) return;
    startTransition(async () => {
      await deleteRecurringAction(rule.id);
      router.refresh();
    });
  }

  // Long-press → delete. We arm a 600ms timer on pointer-down, cancel
  // on pointer-up / leave. If the timer fires, we mark the gesture so
  // the click handler can skip the edit branch.
  const longPressed = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  function startLongPress() {
    longPressed.current = false;
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      commitDelete();
    }, 600);
  }
  function cancelLongPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  async function fillAction(amount: number) {
    return fillPendingRecurringAmountAction(rule.id, amount);
  }

  return (
    <li
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onContextMenu={(e) => {
        // Long-press on some touch browsers fires `contextmenu` rather than
        // our pointer-based timer — wire that path to delete too.
        e.preventDefault();
        commitDelete();
      }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition",
        !rule.active && "opacity-60",
        (pending || busy) && "opacity-60 pointer-events-none"
      )}
    >
      <span
        className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: "color-mix(in srgb, var(--peach-soft) 40%, var(--card))",
        }}
        aria-hidden
      >
        <EmojiOrIcon value={rule.category?.icon} fallback="recurring" size={20} />
      </span>
      {/* Name + status — clickable target for editing the rule */}
      <button
        type="button"
        onClick={() => {
          if (longPressed.current) return;
          onEdit();
        }}
        className="flex-1 min-w-0 text-left"
      >
        <p className="font-semibold text-[14px] leading-tight truncate">
          {rule.note?.trim() || rule.category?.name || t("common.uncategorizedFull")}
        </p>
        <p className="text-[11px] text-(--muted) leading-tight mt-0.5 flex items-center gap-1 flex-wrap">
          <span>{PERIOD_LABEL[rule.period]}</span>
          <span>·</span>
          {isVariable && (
            <>
              <span>{t("recurring.variableBillBadge")}</span>
              <span>·</span>
            </>
          )}
          {appliedThisPeriod ? (
            <span className="text-(--income)">
              {t("recurring.appliedThisPeriod")}
            </span>
          ) : (
            <span>
              {t("recurring.nextRun", {
                when: formatDate(rule.next_run_at, fmtLocale),
              })}
            </span>
          )}
          {ruleCurrency !== homeCurrency && (
            <>
              <span>·</span>
              <span className="tabular-nums">{ruleCurrency}</span>
            </>
          )}
        </p>
      </button>
      {/* Amount — inline input when the rule is variable-cost AND
          we don't already have a recorded fill amount for the current
          period. Saving materialises the rule for this period (creates
          the tx and bumps last_run_at / next_run_at). When the rule
          has a `last_fill_amount` and we're inside the applied window,
          fall through to the static display so the user sees what
          they typed last time. */}
      {isVariable && !(appliedThisPeriod && rule.last_fill_amount !== null) ? (
        <InlineAmount
          initial={null}
          currency={ruleCurrency}
          action={fillAction}
        />
      ) : (
        <div
          className={cn(
            "tabular-nums font-semibold shrink-0 text-[14px]",
            rule.kind === "income"
              ? "text-(--income)"
              : "text-(--expense)"
          )}
        >
          {rule.kind === "income" ? "+" : "−"}
          {formatCurrency(
            isVariable ? rule.last_fill_amount! : rule.amount!,
            ruleCurrency,
            fmtLocale
          )}
        </div>
      )}
    </li>
  );
}

/** True when `last_run_at` falls in the current period bucket. */
function isAppliedThisPeriod(
  lastRunAt: string | null,
  period: RecurPeriod
): boolean {
  if (!lastRunAt) return false;
  const last = new Date(lastRunAt);
  const now = new Date();
  if (Number.isNaN(last.getTime())) return false;
  switch (period) {
    case "daily":
      return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate()
      );
    case "weekly": {
      // ISO week comparison via Monday-anchored start date
      const startOfWeek = (d: Date) => {
        const x = new Date(d);
        const day = (x.getDay() + 6) % 7; // 0 = Monday
        x.setHours(0, 0, 0, 0);
        x.setDate(x.getDate() - day);
        return x.getTime();
      };
      return startOfWeek(last) === startOfWeek(now);
    }
    case "monthly":
      return (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth()
      );
    case "yearly":
      return last.getFullYear() === now.getFullYear();
    default:
      return false;
  }
}

function EditRecurringModal({
  rule,
  categories,
  accounts,
  trips,
  homeCurrency,
  onClose,
}: {
  rule: RecurringRule;
  categories: Category[];
  accounts: RecurringAccountChoice[];
  trips: RecurringTripChoice[];
  homeCurrency: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<TxKind>(rule.kind);
  const [period, setPeriod] = useState<RecurPeriod>(rule.period);
  const [categoryId, setCategoryId] = useState<string>(rule.category_id ?? "");
  const [accountId, setAccountId] = useState<string>(rule.account_id ?? "");
  const [tripId, setTripId] = useState<string>(rule.trip_id ?? "");
  const [currency, setCurrency] = useState(rule.fx_currency ?? homeCurrency);
  const [amount, setAmount] = useState(rule.amount === null ? "" : String(rule.amount));
  const [note, setNote] = useState(rule.note ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Subs follow their parent in the dropdown so the user reads top-down
  // as a tree even though `<option>` can't render real groups.
  const visibleCats = sortByHierarchy(
    categories.filter((c) => c.kind === kind),
  );

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("amount", amount);
    fd.set("categoryId", categoryId);
    fd.set("accountId", accountId);
    fd.set("tripId", tripId);
    if (currency && currency !== homeCurrency) fd.set("fxCurrency", currency);
    fd.set("note", note);
    fd.set("period", period);
    startTransition(async () => {
      const result = await updateRecurringAction(rule.id, fd);
      if (result?.ok === false) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,500px)] max-h-[85vh] overflow-y-auto rounded-2xl bg-(--card) border border-(--border) shadow-2xl p-5"
      >
        <h2 className="font-semibold text-lg mb-4">{t("recurring.editTitle")}</h2>
        <div className="space-y-3">
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
                kind === "income"
                  ? "bg-(--income) text-white"
                  : "text-(--muted)"
              )}
            >
              {t("transactions.kindToggleIncome")}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("recurring.amountOptional")}
              className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) tabular-nums"
            />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as RecurPeriod)}
              className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
            >
              <option value="monthly">{t("recurring.frequencyMonthly")}</option>
              <option value="weekly">{t("recurring.frequencyWeekly")}</option>
              <option value="daily">{t("recurring.frequencyDaily")}</option>
              <option value="yearly">{t("recurring.frequencyYearly")}</option>
            </select>
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              ariaLabel={t("accounts.currencyLabel")}
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
          >
            <option value="">{t("recurring.selectCategory")}</option>
            {visibleCats.map((c) => (
              <option key={c.id} value={c.id}>
                {iconNameToEmoji(c.icon)} {c.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
            >
              <option value="">{t("accounts.noAccount")}</option>
              {accounts
                .filter((a) => a.currency === currency)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.icon ?? "💰") + " " + a.name}
                  </option>
                ))}
            </select>
            <select
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
            >
              <option value="">{t("trips.noTrip")}</option>
              {trips.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {(tr.icon ?? "✈️") + " " + tr.name}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("recurring.notePlaceholder")}
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
          />

          {error && (
            <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 px-4 py-2.5 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="flex-[2] px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
            >
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>

          {/* Destructive action lives below the primary row so it
              can't be mistaken for the Save CTA. Deleting the rule
              only removes the template — past transactions that the
              cron / inline-fill already materialised stay put,
              because nothing in `transactions` references the rule. */}
          <button
            type="button"
            onClick={() => {
              if (!confirm(t("recurring.deleteConfirm"))) return;
              startTransition(async () => {
                await deleteRecurringAction(rule.id);
                router.refresh();
                onClose();
              });
            }}
            disabled={pending}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-(--expense) hover:bg-(--expense)/10 transition disabled:opacity-50"
          >
            <JtIcon name="trash2" size={16} />
            {t("common.delete")}
          </button>
        </div>
      </div>
    </>
  );
}
