"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { JtIcon, EmojiOrIcon, iconNameToEmoji } from "@/components/icons";
import { sortByHierarchy } from "@/lib/categories";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Category, TxKind } from "@/lib/types";
import type { RecurPeriod, RecurringRule } from "@/lib/recurring";
import { isAppliedThisPeriod } from "@/lib/recurring";
import {
  createRecurringAction,
  deleteRecurringAction,
  fillPendingRecurringAmountAction,
  reorderRecurringAction,
  runDueAction,
  skipRecurringPeriodAction,
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
  // Reorder mode for the list. While true, every row gets a wiggle
  // animation, tap-to-edit / long-press-to-delete are suspended, and
  // the "+" button in the header flips to "✓ เสร็จ" which commits
  // the new order.
  const [reordering, setReordering] = useState(false);
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const [savingOrder, startSavingOrder] = useTransition();

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
      {/* Mobile header — back / title / + add (or ✓ done in reorder mode) */}
      <div className="flex items-center justify-between">
        <Link
          href="/more"
          aria-label={t("common.back")}
          className="h-10 w-10 rounded-full bg-(--card) border border-(--border) flex items-center justify-center shadow-sm hover:bg-(--background) transition"
        >
          <JtIcon name="chevron-left" size={18} />
        </Link>
        <h1 className="text-base font-semibold">{t("recurring.title")}</h1>
        {reordering ? (
          <button
            type="button"
            onClick={() => {
              const ids = orderOverride;
              if (!ids || ids.length === 0) {
                setReordering(false);
                return;
              }
              startSavingOrder(async () => {
                await reorderRecurringAction(ids);
                setOrderOverride(null);
                setReordering(false);
                router.refresh();
              });
            }}
            disabled={savingOrder}
            aria-label={t("common.done")}
            className="h-10 px-3 rounded-full flex items-center justify-center gap-1 text-white text-sm font-semibold shadow-sm transition active:scale-95 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, var(--peach-strong) 0%, var(--peach-deep) 100%)",
            }}
          >
            <span aria-hidden>{savingOrder ? "…" : "✓"}</span>
            {t("common.done")}
          </button>
        ) : (
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
        )}
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
          <ReorderableRuleList
            rules={rules}
            homeCurrency={homeCurrency}
            pending={pending}
            reordering={reordering}
            orderOverride={orderOverride}
            onOrderChange={setOrderOverride}
            onEdit={(id) => setEditingId(id)}
          />
          {/* Reorder entry / helper. Tap to enter wiggle mode; once in,
              the helper text guides the gesture and the header "+"
              flips to "✓ เสร็จ". */}
          {reordering ? (
            <p className="text-center text-xs text-(--muted)">
              {t("recurring.reorderHelper")}
            </p>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs text-(--muted)">
              <span>{t("recurring.listHelper")}</span>
              {rules.length > 1 && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => setReordering(true)}
                    className="inline-flex items-center gap-1 font-medium text-(--accent) hover:underline"
                  >
                    <JtIcon name="layers" size={12} />
                    {t("recurring.reorderButton")}
                  </button>
                </>
              )}
            </div>
          )}
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
  reordering = false,
}: {
  rule: RecurringRule;
  homeCurrency: string;
  pending: boolean;
  onEdit: () => void;
  /** When true, tap-to-edit and long-press-to-delete are suspended
   *  so the gesture goes to the drag/reorder wrapper instead. */
  reordering?: boolean;
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
  async function skipAction() {
    return skipRecurringPeriodAction(rule.id);
  }
  // Mirror /reports — the row is "skipped this period" when the
  // cached fill is the 0 sentinel and we are inside the rule's
  // current bucket.
  const ruleIsSkipped =
    isAppliedThisPeriod(rule.last_run_at, rule.period) &&
    rule.last_fill_amount === 0;

  return (
    <li
      onPointerDown={reordering ? undefined : startLongPress}
      onPointerUp={reordering ? undefined : cancelLongPress}
      onPointerLeave={reordering ? undefined : cancelLongPress}
      onContextMenu={
        reordering
          ? undefined
          : (e) => {
              // Long-press on some touch browsers fires `contextmenu`
              // rather than our pointer-based timer — wire that path
              // to delete too.
              e.preventDefault();
              commitDelete();
            }
      }
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
      {/* Name + status — clickable target for editing the rule.
          During reorder mode the tap target is inert so the gesture
          falls through to the drag wrapper. iOS Safari swallows
          events on `disabled` buttons (including touchstart that
          dnd-kit needs), so we use aria-disabled + an onClick
          guard instead. */}
      <button
        type="button"
        onClick={() => {
          if (reordering) return;
          if (longPressed.current) return;
          onEdit();
        }}
        aria-disabled={reordering}
        className={cn(
          "flex-1 min-w-0 text-left",
          reordering && "cursor-grab"
        )}
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
          key={ruleIsSkipped ? "skip" : "fill"}
          initial={ruleIsSkipped ? 0 : null}
          currency={ruleCurrency}
          action={fillAction}
          onSkip={skipAction}
          skipped={ruleIsSkipped}
        />
      ) : ruleIsSkipped ? (
        // Fixed (or variable + applied) rule the user marked
        // "no value this period" — show "-" instead of the cached
        // amount so it reads consistently with /reports.
        <InlineAmount
          key="skip-static"
          initial={0}
          currency={ruleCurrency}
          action={fillAction}
          onSkip={skipAction}
          skipped
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

/**
 * Renders the recurring rule list, optionally wrapped in a dnd-kit
 * SortableContext so the rows can be dragged into a new order. The
 * `orderOverride` lifted state lets the parent commit (or cancel)
 * the reordering with the "✓ เสร็จ" / nav-back gestures.
 *
 * Outside of reorder mode, this falls through to a plain `<ul>` of
 * RuleRows — no DnD overhead.
 */
function ReorderableRuleList({
  rules,
  homeCurrency,
  pending,
  reordering,
  orderOverride,
  onOrderChange,
  onEdit,
}: {
  rules: RecurringRule[];
  homeCurrency: string;
  pending: boolean;
  reordering: boolean;
  orderOverride: string[] | null;
  onOrderChange: (next: string[] | null) => void;
  onEdit: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Short touch delay so we don't fight the surrounding scroll
    // outside reorder mode (irrelevant here since the sensor is only
    // active while `reordering`, but consistent with the category
    // grid feel).
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 6 } })
  );

  // Materialize the rendered order. While editing, the user's local
  // reorders take precedence; otherwise we follow the server-sorted
  // `rules`.
  const orderedRules = useMemo(() => {
    if (!orderOverride) return rules;
    const byId = new Map(rules.map((r) => [r.id, r] as const));
    const out: RecurringRule[] = [];
    for (const id of orderOverride) {
      const r = byId.get(id);
      if (r) out.push(r);
    }
    for (const r of rules) {
      if (!orderOverride.includes(r.id)) out.push(r);
    }
    return out;
  }, [rules, orderOverride]);

  const ids = orderedRules.map((r) => r.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    onOrderChange(arrayMove(ids, from, to));
  }

  const listClass =
    "rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border)/60 overflow-hidden";

  if (!reordering) {
    return (
      <ul className={listClass}>
        {orderedRules.map((r) => (
          <RuleRow
            key={r.id}
            rule={r}
            homeCurrency={homeCurrency}
            pending={pending}
            onEdit={() => onEdit(r.id)}
          />
        ))}
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={listClass}>
          {orderedRules.map((r, i) => (
            <SortableRuleRow
              key={r.id}
              rule={r}
              homeCurrency={homeCurrency}
              pending={pending}
              onEdit={() => onEdit(r.id)}
              wiggleVariant={i % 2 === 0 ? "a" : "b"}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRuleRow({
  rule,
  homeCurrency,
  pending,
  onEdit,
  wiggleVariant,
}: {
  rule: RecurringRule;
  homeCurrency: string;
  pending: boolean;
  onEdit: () => void;
  wiggleVariant: "a" | "b";
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Without `touch-action: none` mobile browsers claim touchstart
    // for native scroll and the press never promotes into a drag.
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        wiggleVariant === "a" ? "wiggle-a" : "wiggle-b",
        isDragging && "z-10 opacity-80"
      )}
      {...attributes}
      {...listeners}
    >
      <RuleRow
        rule={rule}
        homeCurrency={homeCurrency}
        pending={pending}
        onEdit={onEdit}
        reordering
      />
    </div>
  );
}
