"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

import { EmojiOrIcon, JtIcon } from "@/components/icons";
import { ALL_CURRENCIES, PINNED_COUNT } from "@/lib/currencies";
import { getFxRateAction } from "@/app/(app)/transactions/fx-actions";
import { suggestCategoryAction } from "@/app/(app)/transactions/categorize-action";
import { sortByHierarchy } from "@/lib/categories";
import { cn, formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";
import type {
  AccountChoice,
  TripChoice,
} from "@/components/transaction-form";

type Initial = {
  kind: TxKind;
  amount: number;
  categoryId: string | null;
  note: string | null;
  paymentMethod: PaymentMethod | null;
  occurredAt: string;
  tripId: string | null;
};

type Props = {
  categories: Category[];
  accounts?: AccountChoice[];
  activeTrip?: TripChoice | null;
  noteSuggestions?: string[];
  currency?: string;
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  initial?: Initial;
  /** Optional small control rendered in the header next to the title.
   *  The new-tx flow uses this slot for the compact receipt-scan
   *  button so OCR stays one tap away without taking a whole card. */
  headerAction?: React.ReactNode;
};

const PEACH_STRONG = "#E89A6A";
const PEACH_SOFT = "#F9D5B4";
const PEACH_DEEP = "#D87A45";
const PEACH_TEXT = "#6E3A12";
const PEACH_GRADIENT =
  "linear-gradient(135deg, color-mix(in srgb, #F9D5B4 65%, var(--card)) 0%, color-mix(in srgb, #F4B58A 38%, var(--card)) 100%)";

/**
 * Redesigned add-transaction form. Matches the Figma mockup: peach
 * amount card, stacked payment pills, horizontal account pills, 4-col
 * category grid, bone-handle save CTA. Wires straight to
 * `createTransactionAction`.
 *
 * The advanced bits the old form exposed (date/time picker, split,
 * trip dropdown, FX inline preview) are intentionally hidden — new
 * tx defaults `occurred_at` to now, inherits the active trip silently,
 * and auto-fetches the FX rate behind the scenes when a foreign
 * currency is selected. Edits still go through the long-form
 * `TransactionForm`, which keeps all that surface area.
 */
export function NewTransactionForm({
  categories,
  accounts,
  activeTrip,
  noteSuggestions,
  currency: homeCurrency = "THB",
  action,
  initial,
  headerAction,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<TxKind>(initial?.kind ?? "expense");
  const [amountInput, setAmountInput] = useState<string>(
    initial?.amount ? String(initial.amount) : ""
  );
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial?.paymentMethod ?? "cash"
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.categoryId ?? null
  );
  const [accountId, setAccountId] = useState<string | null>(null);
  const [txCurrency, setTxCurrency] = useState<string>(
    activeTrip?.currency && activeTrip.currency !== homeCurrency
      ? activeTrip.currency
      : homeCurrency
  );
  const [previewRate, setPreviewRate] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);

  // FX preview — same debounce pattern as the long form.
  useEffect(() => {
    if (txCurrency === homeCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewRate(null);
      setPreviewError(null);
      return;
    }
    setPreviewError(null);
    const id = setTimeout(async () => {
      const result = await getFxRateAction(txCurrency, homeCurrency);
      if (result.ok) setPreviewRate(result.rate);
      else {
        setPreviewError(result.error);
        setPreviewRate(null);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [txCurrency, homeCurrency]);

  // Auto-detach account when its currency stops matching the form. Same
  // reasoning as the long form: listAccounts skips currency-mismatched
  // rows from balance math, so a silent mismatch hides the row from the
  // headline number.
  useEffect(() => {
    if (!accountId || !accounts) return;
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;
    if (acc.currency !== txCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccountId(null);
    }
  }, [txCurrency, accountId, accounts]);

  const numAmt = Number(amountInput) || 0;
  const previewHomeAmount =
    txCurrency !== homeCurrency && previewRate !== null
      ? numAmt * previewRate
      : null;

  const visibleCats = sortByHierarchy(
    categories.filter((c) => c.kind === kind)
  );
  const eligibleAccounts = (accounts ?? []).filter(
    (a) => a.currency === txCurrency && !a.archived
  );

  function clear() {
    setAmountInput("");
    setNote("");
    setCategoryId(null);
    setAccountId(null);
    setPaymentMethod("cash");
    setKind("expense");
    setError(null);
    setAiHint(null);
  }

  async function runAiCategorize() {
    if (!note.trim() || aiBusy) return;
    setAiBusy(true);
    setAiHint(null);
    try {
      const result = await suggestCategoryAction({ note: note.trim(), kind });
      if (result.ok === false) {
        setAiHint(result.error);
      } else if (result.categoryId) {
        setCategoryId(result.categoryId);
        if (result.confidence === "low") {
          setAiHint(t("transactions.aiCategorizeLowConfidence"));
        }
      } else {
        setAiHint(t("transactions.aiCategorizeNoMatch"));
      }
    } finally {
      setAiBusy(false);
    }
  }

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // No datetime-local picker — set occurredAt to "now" in ISO so
        // the server's zod offset validator is happy.
        fd.set("occurredAt", new Date().toISOString());
        startTransition(async () => {
          const result = await action(fd);
          if (result && "ok" in result && result.ok === false) {
            setError(result.error);
          }
        });
      }}
      className="space-y-4"
    >
      {/* Hidden inputs — these mirror the field names readTransactionInput
          parses on the server. Keeping them as <input type="hidden">
          means FormData on submit is the single source of truth. */}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="amount" value={amountInput} />
      <input type="hidden" name="fxCurrency" value={txCurrency} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />
      <input type="hidden" name="accountId" value={accountId ?? ""} />
      {/* Silently inherit the active trip — same UX as the old form's
          default-on toggle. User can detach via the trip page after
          saving if needed. */}
      <input type="hidden" name="tripId" value={activeTrip?.id ?? ""} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("common.cancel")}
          className="h-10 w-10 rounded-full bg-(--card) border border-(--border) flex items-center justify-center shadow-sm hover:bg-(--background) transition"
        >
          <JtIcon name="x" size={18} />
        </button>
        <h1 className="text-base font-semibold">
          {t("transactions.newTitle")}
        </h1>
        <div className="flex items-center gap-2">
          {headerAction}
          <button
            type="button"
            onClick={clear}
            className="text-sm font-medium px-2 py-1"
            style={{ color: PEACH_STRONG }}
          >
            {t("common.clear")}
          </button>
        </div>
      </div>

      {/* Kind toggle */}
      <div className="grid grid-cols-2 p-1.5 rounded-full border border-(--border) bg-(--card)">
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={cn(
            "py-2.5 rounded-full text-sm font-semibold transition",
            kind === "expense" ? "text-white shadow-sm" : "text-(--muted)"
          )}
          style={kind === "expense" ? { background: PEACH_STRONG } : undefined}
        >
          {t("transactions.kindToggleExpense").replace(/^[^\s]+\s/, "")}
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={cn(
            "py-2.5 rounded-full text-sm font-semibold transition",
            kind === "income" ? "text-white shadow-sm" : "text-(--muted)"
          )}
          style={kind === "income" ? { background: PEACH_STRONG } : undefined}
        >
          {t("transactions.kindToggleIncome").replace(/^[^\s]+\s/, "")}
        </button>
      </div>

      {/* Amount card */}
      <section
        className="relative rounded-3xl px-5 py-6 border"
        style={{
          background: PEACH_GRADIENT,
          borderColor: "color-mix(in srgb, #E89A6A 30%, transparent)",
        }}
      >
        <div className="absolute top-3 right-3">
          <CurrencyChip value={txCurrency} onChange={setTxCurrency} />
        </div>
        <p
          className="text-center text-sm font-medium"
          style={{ color: `color-mix(in srgb, ${PEACH_TEXT} 75%, transparent)` }}
        >
          {t("common.amount")}
        </p>
        <label className="block mt-1 cursor-text">
          <div className="flex items-center justify-center gap-2">
            <span
              className="text-3xl font-bold tabular-nums"
              style={{
                color: `color-mix(in srgb, ${PEACH_TEXT} 80%, transparent)`,
              }}
            >
              ฿
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) =>
                setAmountInput(e.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder="0"
              required
              className="w-40 bg-transparent text-5xl font-extrabold tabular-nums text-center text-white placeholder:text-white/85 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
              style={{
                color: "white",
                textShadow: "0 1px 0 rgba(255,255,255,0.25)",
              }}
            />
          </div>
        </label>
        {txCurrency !== homeCurrency && (
          <p
            className="mt-2 text-center text-xs"
            style={{ color: `color-mix(in srgb, ${PEACH_TEXT} 70%, transparent)` }}
          >
            {previewError ? (
              <span>{t("transactions.fxError")}</span>
            ) : previewHomeAmount !== null ? (
              <span>
                ≈{" "}
                <span className="font-semibold tabular-nums">
                  {formatCurrency(previewHomeAmount, homeCurrency, fmtLocale)}
                </span>
              </span>
            ) : (
              <span className="opacity-70">
                {t("transactions.fxFetching")}
              </span>
            )}
          </p>
        )}
      </section>

      {/* Note + Payment */}
      <div className="grid grid-cols-5 gap-3 items-stretch">
        <label className="col-span-3 rounded-2xl border border-(--border) bg-(--card) px-4 py-3 flex items-start gap-2">
          <span className="text-base mt-0.5" aria-hidden>
            📝
          </span>
          <textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("common.noteOptional")}
            rows={3}
            maxLength={500}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-(--muted) focus:outline-none"
          />
        </label>

        <div className="col-span-2 grid grid-rows-2 gap-2">
          <PayPill
            label={t("transactions.paymentCash")}
            icon="💵"
            selected={paymentMethod === "cash"}
            onClick={() => setPaymentMethod("cash")}
          />
          <PayPill
            label={t("transactions.paymentTransfer")}
            icon="💵"
            selected={paymentMethod === "transfer"}
            onClick={() => setPaymentMethod("transfer")}
          />
        </div>
      </div>

      {/* Account pills — only when ledger has any accounts in the
          current tx currency. "ไม่ระบุ" sits first as the default. */}
      {accounts && accounts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">
            {t("accounts.accountField")}
          </h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            <AccountPill
              label={t("accounts.noAccount").replace(/^—\s*|\s*—$/g, "")}
              selected={accountId === null}
              onClick={() => setAccountId(null)}
            />
            {eligibleAccounts.map((a) => (
              <AccountPill
                key={a.id}
                label={a.name}
                icon={a.icon ?? "💰"}
                selected={accountId === a.id}
                onClick={() => setAccountId(a.id)}
              />
            ))}
          </div>
          {eligibleAccounts.length === 0 && (
            <p className="text-[11px] text-(--muted) mt-1">
              {t("accounts.noMatchingCurrency", { currency: txCurrency })}
            </p>
          )}
        </section>
      )}

      {/* Category grid */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">{t("common.category")}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={runAiCategorize}
              disabled={aiBusy || note.trim().length === 0}
              title={
                note.trim().length === 0
                  ? t("transactions.aiCategorizeNeedsNote")
                  : t("transactions.aiCategorizeHint")
              }
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `color-mix(in srgb, ${PEACH_SOFT} 55%, var(--card))`,
                color: "#8A4A1C",
              }}
            >
              <JtIcon
                name="sparkles"
                size={12}
                className={aiBusy ? "animate-pulse" : ""}
              />
              {aiBusy
                ? t("transactions.aiCategorizeLoading")
                : t("transactions.aiCategorizeButton")}
            </button>
            <Link
              href="/categories"
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${PEACH_SOFT} 55%, var(--card))`,
                color: "#8A4A1C",
              }}
            >
              <span aria-hidden>✏️</span>
              {t("common.edit")}
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {visibleCats.map((c) => (
            <CategoryTile
              key={c.id}
              category={c}
              selected={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            />
          ))}
          <Link
            href="/categories"
            aria-label={t("categories.title")}
            className="aspect-square rounded-2xl border border-dashed border-(--border) bg-(--card) flex items-center justify-center text-(--muted) hover:bg-(--background) transition"
          >
            <span className="text-2xl leading-none">+</span>
          </Link>
        </div>
        {aiHint && (
          <p className="mt-1.5 text-xs text-(--muted)">{aiHint}</p>
        )}
      </section>

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Save CTA — sticks above the fixed mobile bottom nav so the
          button is always reachable without scrolling to the end. */}
      <div className="sticky bottom-24 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full py-4 text-base font-bold text-white shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
          style={{
            background: `linear-gradient(135deg, ${PEACH_STRONG} 0%, ${PEACH_DEEP} 100%)`,
            boxShadow:
              "0 10px 24px -8px color-mix(in srgb, #E89A6A 65%, transparent)",
          }}
        >
          <span aria-hidden className="text-lg">🦴</span>
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

function CurrencyChip({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="currency"
      className="appearance-none pl-3 pr-7 py-1.5 rounded-full bg-(--card)/90 text-xs font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23E89A6A' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.5rem center",
        backgroundSize: "12px",
      }}
    >
      {ALL_CURRENCIES.slice(0, PINNED_COUNT).map((c) => (
        <option key={c.code} value={c.code}>
          {c.code}
        </option>
      ))}
      <option disabled value="__divider__">── Other ──</option>
      {ALL_CURRENCIES.slice(PINNED_COUNT).map((c) => (
        <option key={c.code} value={c.code}>
          {c.code}
        </option>
      ))}
    </select>
  );
}

function PayPill({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full h-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border bg-(--card) text-sm font-medium transition",
        "border-(--border) text-(--foreground)"
      )}
      style={selected ? { boxShadow: `inset 0 0 0 2px ${PEACH_STRONG}` } : undefined}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </span>
      {selected && (
        <span
          className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[11px]"
          style={{ background: PEACH_STRONG }}
          aria-hidden
        >
          ✓
        </span>
      )}
    </button>
  );
}

function AccountPill({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition whitespace-nowrap",
        selected
          ? "text-white border-transparent"
          : "bg-(--card) border-(--border) text-(--foreground)"
      )}
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${PEACH_STRONG} 0%, color-mix(in srgb, ${PEACH_SOFT} 50%, ${PEACH_STRONG}) 100%)`,
            }
          : undefined
      }
    >
      {icon && <span aria-hidden>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

function CategoryTile({
  category,
  selected,
  onClick,
}: {
  category: Category;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative aspect-square rounded-2xl border bg-(--card) flex flex-col items-center justify-center gap-1 p-2 transition",
        selected ? "border-transparent" : "border-(--border) hover:bg-(--background)"
      )}
      style={selected ? { boxShadow: `inset 0 0 0 2px ${PEACH_STRONG}` } : undefined}
    >
      <EmojiOrIcon value={category.icon} fallback="sparkle" size={28} />
      <span className="text-xs font-medium leading-tight text-center line-clamp-1">
        {category.name}
      </span>
    </button>
  );
}
