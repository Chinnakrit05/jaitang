"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  Pencil,
  Plane,
  Wallet,
} from "lucide-react";
import type { Category, TxKind } from "@/lib/types";
import type { RecurPeriod, RecurringRule } from "@/lib/recurring";
import {
  createRecurringAction,
  deleteRecurringAction,
  runDueAction,
  toggleRecurringAction,
  updateRecurringAction,
} from "@/app/(app)/recurring/actions";
import { CurrencyPicker } from "@/components/currency-picker";
import { SubscriptionStats } from "@/components/subscription-stats";
import { formatCurrency, formatDate, cn, toLocalDateTimeInput } from "@/lib/utils";
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
  const [showForm, setShowForm] = useState(rules.length === 0);
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
    <div className="space-y-4">
      <SubscriptionStats rules={rules} homeCurrency={homeCurrency} />

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
          accounts={accounts}
          trips={trips}
          homeCurrency={homeCurrency}
          onDone={() => setShowForm(false)}
        />
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-(--muted) px-1">{t("recurring.empty")}</p>
      ) : (
        <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
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
      )}

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
  const visibleCats = categories.filter((c) => c.kind === kind);

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
        if (accountId) fd.set("accountId", accountId);
        if (tripId) fd.set("tripId", tripId);
        if (currency && currency !== homeCurrency) fd.set("fxCurrency", currency);
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
              {c.icon} {c.name}
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
            <Wallet size={12} />
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
            <Plane size={12} />
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
          {t("recurring.startDate")}
        </label>
        <input
          ref={startRef}
          name="startDate"
          type="datetime-local"
          required
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
  };
  const ruleCurrency = rule.fx_currency ?? homeCurrency;

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition",
        !rule.active && "opacity-60"
      )}
    >
      <span className="text-2xl shrink-0">{rule.category?.icon ?? "✨"}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-1.5 flex-wrap">
          <span>{rule.category?.name ?? t("common.uncategorizedFull")}</span>
          {rule.account && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-1.5 py-0.5">
              <Wallet size={10} />
              {rule.account.name}
            </span>
          )}
          {rule.trip && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-1.5 py-0.5">
              {rule.trip.icon ?? "✈️"}
              {rule.trip.name}
            </span>
          )}
          {ruleCurrency !== homeCurrency && (
            <span className="inline-flex items-center text-[10px] font-medium text-(--muted) bg-(--background) border border-(--border) rounded-full px-1.5 py-0.5 tabular-nums">
              {ruleCurrency}
            </span>
          )}
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
        className={`tabular-nums font-semibold shrink-0 ${
          rule.kind === "income" ? "text-(--income)" : "text-(--expense)"
        }`}
      >
        {rule.kind === "income" ? "+" : "−"}
        {formatCurrency(rule.amount, ruleCurrency, fmtLocale)}
      </div>
      <button
        type="button"
        onClick={onEdit}
        disabled={pending || busy}
        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground) shrink-0"
        aria-label={t("common.edit")}
        title={t("common.edit")}
      >
        <Pencil size={16} />
      </button>
      <button
        type="button"
        disabled={pending || busy}
        onClick={() =>
          startTransition(async () => {
            await toggleRecurringAction(rule.id, !rule.active);
            router.refresh();
          })
        }
        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground) shrink-0"
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
        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense) shrink-0"
        aria-label={t("common.delete")}
      >
        <Trash2 size={16} />
      </button>
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
  const [amount, setAmount] = useState(String(rule.amount));
  const [note, setNote] = useState(rule.note ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visibleCats = categories.filter((c) => c.kind === kind);

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
                {c.icon} {c.name}
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
        </div>
      </div>
    </>
  );
}
