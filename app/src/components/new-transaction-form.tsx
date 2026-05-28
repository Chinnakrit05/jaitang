"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { EmojiOrIcon, JtIcon } from "@/components/icons";
import { ALL_CURRENCIES, PINNED_COUNT } from "@/lib/currencies";
import { getFxRateAction } from "@/app/(app)/transactions/fx-actions";
import { suggestCategoryAction } from "@/app/(app)/transactions/categorize-action";
import { reorderCategoriesAction } from "@/app/(app)/categories/actions";
import { sortByHierarchy } from "@/lib/categories";
import { cn, formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { isPet, type Pet } from "@/lib/theme";
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
  /** Edit-mode extras — preserved on save so the row keeps its
   *  account / FX flavour even though the new form doesn't expose
   *  every field. */
  accountId?: string | null;
  fxCurrency?: string | null;
};

type Props = {
  categories: Category[];
  accounts?: AccountChoice[];
  activeTrip?: TripChoice | null;
  noteSuggestions?: string[];
  currency?: string;
  /** Ledger-level fallback for the payment pill on create flow.
   *  Edit flow still wins via `initial.paymentMethod`. Null = no
   *  preference; we then fall back to "cash". */
  defaultPaymentMethod?: "cash" | "transfer" | null;
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  initial?: Initial;
  /** Optional small control rendered in the header next to the title.
   *  The new-tx flow uses this slot for the compact receipt-scan
   *  button so OCR stays one tap away without taking a whole card. */
  headerAction?: React.ReactNode;
};

const PEACH_STRONG = "var(--peach-strong)";
const PEACH_SOFT = "var(--peach-soft)";
const PEACH_DEEP = "var(--peach-deep)";
const PEACH_TEXT = "var(--peach-fg)";
const PEACH_GRADIENT =
  "linear-gradient(135deg, color-mix(in srgb, var(--peach-soft) 65%, var(--card)) 0%, color-mix(in srgb, var(--peach-mid) 38%, var(--card)) 100%)";

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
  defaultPaymentMethod = null,
  action,
  initial,
  headerAction,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();

  // Active pet for save-button celebratory copy. SSR default is shiba;
  // a MutationObserver picks up live theme changes from /settings.
  const [pet, setPet] = useState<Pet>("shiba");
  useEffect(() => {
    const sync = () => {
      const v = document.documentElement.getAttribute("data-pet");
      setPet(isPet(v) ? v : "shiba");
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-pet"],
    });
    return () => obs.disconnect();
  }, []);
  const petEmoji =
    pet === "blackcat" || pet === "whitecat" ? "🐟" : pet === "pug" ? "🍫" : "🦴";

  const [kind, setKind] = useState<TxKind>(initial?.kind ?? "expense");
  // `datetime-local` wants "YYYY-MM-DDTHH:MM" in the user's local zone, so
  // we format the seed (initial occurred_at on edit, or "now" on create)
  // accordingly. On submit it's converted back to ISO.
  const [occurredAtInput, setOccurredAtInput] = useState<string>(() => {
    const d = initial?.occurredAt ? new Date(initial.occurredAt) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [amountInput, setAmountInput] = useState<string>(
    initial?.amount ? String(initial.amount) : ""
  );
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial?.paymentMethod ?? defaultPaymentMethod ?? "cash"
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    initial?.categoryId ?? null
  );
  const [accountId, setAccountId] = useState<string | null>(
    initial?.accountId ?? null
  );
  const [txCurrency, setTxCurrency] = useState<string>(
    initial?.fxCurrency ??
      (activeTrip?.currency && activeTrip.currency !== homeCurrency
        ? activeTrip.currency
        : homeCurrency)
  );
  const [previewRate, setPreviewRate] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  // Reorder mode for the category grid. While true, every tile wiggles
  // and drag-to-rearrange is enabled. Tapping the pencil chip toggles
  // it on; tapping "เสร็จ" toggles off and persists the new order.
  const [editingCats, setEditingCats] = useState(false);
  // Local override of the rendered category order while in edit mode.
  // We start from the server-sorted `visibleCats` and update on every
  // drag end; the server action only fires when the user taps done.
  const [catOrderOverride, setCatOrderOverride] = useState<string[] | null>(null);

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
  // Lookup map for parent icons — used by CategoryTile to render a
  // small badge in the top-right of any sub-category tile so the user
  // can see what bucket it lives under at a glance.
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const eligibleAccounts = (accounts ?? []).filter(
    (a) => a.currency === txCurrency && !a.archived
  );

  function clear() {
    setAmountInput("");
    setNote("");
    setCategoryId(null);
    setAccountId(null);
    setPaymentMethod(defaultPaymentMethod ?? "cash");
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
        // The date/time picker stores a local-zone string; convert to
        // ISO so the server's zod offset validator accepts it. Falls
        // back to "now" if the input is somehow empty.
        const parsed = occurredAtInput ? new Date(occurredAtInput) : new Date();
        fd.set("occurredAt", parsed.toISOString());
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
      {/* Trip pinning: prefer whatever the row already had on edit;
          otherwise inherit the session's active trip silently. */}
      <input
        type="hidden"
        name="tripId"
        value={initial?.tripId ?? activeTrip?.id ?? ""}
      />

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
            kind === "expense"
              ? "bg-(--expense) text-white shadow-sm"
              : "text-(--expense)"
          )}
        >
          {t("transactions.kindToggleExpense").replace(/^[^\s]+\s/, "")}
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={cn(
            "py-2.5 rounded-full text-sm font-semibold transition",
            kind === "income"
              ? "bg-(--income) text-white shadow-sm"
              : "text-(--income)"
          )}
        >
          {t("transactions.kindToggleIncome").replace(/^[^\s]+\s/, "")}
        </button>
      </div>

      {/* Amount card */}
      <section
        className="relative rounded-3xl px-5 py-6 border"
        style={{
          background: PEACH_GRADIENT,
          borderColor: "color-mix(in srgb, var(--peach-strong) 30%, transparent)",
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
              // iOS Safari prefers the legacy `pattern` heuristic
              // alongside `inputMode` for the decimal keypad. Without
              // the pattern hint, iOS shows the regular text keyboard
              // even on inputMode="decimal".
              pattern="[0-9]*\.?[0-9]*"
              autoComplete="off"
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
      <CategorySection
        categories={visibleCats}
        categoryById={categoryById}
        selectedId={categoryId}
        onSelect={setCategoryId}
        editing={editingCats}
        onToggleEditing={() => setEditingCats((v) => !v)}
        orderOverride={catOrderOverride}
        onOrderChange={setCatOrderOverride}
        aiBusy={aiBusy}
        aiDisabled={note.trim().length === 0}
        aiHint={aiHint}
        runAi={runAiCategorize}
        aiNeedsNoteLabel={t("transactions.aiCategorizeNeedsNote")}
        aiHintLabel={t("transactions.aiCategorizeHint")}
        aiLoadingLabel={t("transactions.aiCategorizeLoading")}
        aiButtonLabel={t("transactions.aiCategorizeButton")}
        editLabel={t("common.edit")}
        doneLabel={t("common.done")}
        categoryLabel={t("common.category")}
        addLabel={t("categories.title")}
      />

      {/* Date/time picker — sits just above the save button so the
          common flow (use "now") needs zero taps and the override is
          one tap away when the user is logging something they paid
          for yesterday. */}
      <div className="rounded-2xl border border-(--border) bg-(--card) px-4 py-3 flex items-center justify-between gap-3">
        <label
          htmlFor="occurredAt-picker"
          className="text-sm font-medium text-(--foreground)/80 shrink-0"
        >
          {t("common.dateTime")}
        </label>
        <input
          id="occurredAt-picker"
          type="datetime-local"
          value={occurredAtInput}
          onChange={(e) => setOccurredAtInput(e.target.value)}
          className="bg-transparent text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-(--accent)/30 rounded-md px-1 py-1"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Save CTA — sticks above the fixed mobile bottom nav so the
          button is always reachable without scrolling to the end.
          Hidden while the user is in category-reorder mode so the
          peach pill doesn't fight the wiggle UI or accept an
          accidental tap during the drag/edit. */}
      {!editingCats && (
        <div className="sticky bottom-24 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full py-4 text-base font-bold text-white shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
            style={{
              background: `linear-gradient(135deg, ${PEACH_STRONG} 0%, ${PEACH_DEEP} 100%)`,
              boxShadow:
                "0 10px 24px -8px color-mix(in srgb, var(--peach-strong) 65%, transparent)",
            }}
          >
            <span aria-hidden className="text-lg">{petEmoji}</span>
            {pending ? t("common.saving") : t(`dashboard.petCelebration.${pet}`)}
          </button>
        </div>
      )}
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
  parent,
  selected,
  onClick,
  editing = false,
  wiggleVariant = "a",
}: {
  category: Category;
  /** When the tile is a sub-category, the resolved parent. Drives the
   *  small icon badge in the top-right corner. null = top-level. */
  parent: Category | null;
  selected: boolean;
  onClick: () => void;
  /** When true, the tile is part of the reorder grid: pointer events
   *  drive the drag instead of selecting the category, and the tile
   *  is wrapped in a wiggle animation by the parent. */
  editing?: boolean;
  wiggleVariant?: "a" | "b";
}) {
  const sortable = useSortable({ id: category.id, disabled: !editing });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Mobile fix: without `touch-action: none`, the browser claims
    // the touchstart for native scrolling and dnd-kit never gets to
    // promote the press into a drag. Only apply while editing so
    // normal scrolling of the page still works in the picker.
    ...(editing ? { touchAction: "none" } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        editing && (wiggleVariant === "a" ? "wiggle-a" : "wiggle-b"),
        isDragging && "z-10 opacity-80"
      )}
      // Pointer events live on the wrapper in edit mode so a slow press
      // doesn't get eaten by the inner <button>'s click handler.
      {...(editing ? { ...attributes, ...listeners } : {})}
    >
      <button
        type="button"
        onClick={editing ? undefined : onClick}
        // Keep the button enabled even in edit mode so touchstart
        // bubbles up to the sortable wrapper (iOS Safari swallows all
        // events on `disabled` buttons, including touchstart, which
        // was what blocked the drag). aria-disabled covers screen
        // readers.
        aria-disabled={editing}
        className={cn(
          "w-full aspect-square rounded-2xl border bg-(--card) flex flex-col items-center justify-center gap-1 p-2 transition",
          selected ? "border-transparent" : "border-(--border) hover:bg-(--background)",
          editing && "cursor-grab active:cursor-grabbing"
        )}
        style={selected ? { boxShadow: `inset 0 0 0 2px ${PEACH_STRONG}` } : undefined}
      >
        {parent && (
          <span
            className="absolute top-1 right-1 h-5 w-5 rounded-full flex items-center justify-center bg-(--background) shadow-sm"
            style={{ fontSize: 12, lineHeight: 1 }}
            title={parent.name}
            aria-label={parent.name}
          >
            <EmojiOrIcon value={parent.icon} fallback="sparkle" size={12} />
          </span>
        )}
        <EmojiOrIcon value={category.icon} fallback="sparkle" size={28} />
        <span className="text-xs font-medium leading-tight text-center line-clamp-1">
          {category.name}
        </span>
      </button>
    </div>
  );
}

function CategorySection({
  categories,
  categoryById,
  selectedId,
  onSelect,
  editing,
  onToggleEditing,
  orderOverride,
  onOrderChange,
  aiBusy,
  aiDisabled,
  aiHint,
  runAi,
  aiNeedsNoteLabel,
  aiHintLabel,
  aiLoadingLabel,
  aiButtonLabel,
  editLabel,
  doneLabel,
  categoryLabel,
  addLabel,
}: {
  categories: Category[];
  categoryById: Map<string, Category>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  editing: boolean;
  onToggleEditing: () => void;
  orderOverride: string[] | null;
  onOrderChange: (next: string[] | null) => void;
  aiBusy: boolean;
  aiDisabled: boolean;
  aiHint: string | null;
  runAi: () => void;
  aiNeedsNoteLabel: string;
  aiHintLabel: string;
  aiLoadingLabel: string;
  aiButtonLabel: string;
  editLabel: string;
  doneLabel: string;
  categoryLabel: string;
  addLabel: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // We're already in explicit reorder mode AND the editing tile has
    // touch-action: none, so a short delay is enough — anything longer
    // makes the drag feel sticky on phones. Tolerance keeps a 6px
    // wobble during the press from canceling.
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 6 } })
  );
  const [saving, startSaving] = useTransition();

  // Materialize the rendered order. While editing, the user's local
  // reorders take precedence; otherwise we fall back to the server-
  // sorted `categories`.
  const orderedCategories = useMemo(() => {
    if (!orderOverride) return categories;
    const byId = new Map(categories.map((c) => [c.id, c] as const));
    const ordered: Category[] = [];
    for (const id of orderOverride) {
      const c = byId.get(id);
      if (c) ordered.push(c);
    }
    // Append any new categories that arrived from the server after the
    // override was captured (e.g. user added a category mid-edit).
    for (const c of categories) {
      if (!orderOverride.includes(c.id)) ordered.push(c);
    }
    return ordered;
  }, [categories, orderOverride]);

  const ids = orderedCategories.map((c) => c.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    onOrderChange(arrayMove(ids, from, to));
  }

  function commitOrder() {
    if (!orderOverride || orderOverride.length === 0) {
      onToggleEditing();
      return;
    }
    startSaving(async () => {
      await reorderCategoriesAction(orderOverride);
      onOrderChange(null);
      onToggleEditing();
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">{categoryLabel}</h2>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              type="button"
              onClick={runAi}
              disabled={aiBusy || aiDisabled}
              title={aiDisabled ? aiNeedsNoteLabel : aiHintLabel}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `color-mix(in srgb, ${PEACH_SOFT} 55%, var(--card))`,
                color: "var(--peach-chip-fg)",
              }}
            >
              <JtIcon
                name="sparkles"
                size={12}
                className={aiBusy ? "animate-pulse" : ""}
              />
              {aiBusy ? aiLoadingLabel : aiButtonLabel}
            </button>
          )}
          <button
            type="button"
            onClick={editing ? commitOrder : onToggleEditing}
            disabled={saving}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full transition disabled:opacity-60"
            style={{
              background: editing
                ? PEACH_STRONG
                : `color-mix(in srgb, ${PEACH_SOFT} 55%, var(--card))`,
              color: editing ? "white" : "var(--peach-chip-fg)",
            }}
          >
            <span aria-hidden>{editing ? (saving ? "…" : "✓") : "✏️"}</span>
            {editing ? doneLabel : editLabel}
          </button>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2">
            {orderedCategories.map((c, i) => (
              <CategoryTile
                key={c.id}
                category={c}
                parent={c.parent_id ? categoryById.get(c.parent_id) ?? null : null}
                selected={selectedId === c.id}
                onClick={() => onSelect(c.id)}
                editing={editing}
                wiggleVariant={i % 2 === 0 ? "a" : "b"}
              />
            ))}
            {!editing && (
              <Link
                href="/categories"
                aria-label={addLabel}
                className="aspect-square rounded-2xl border border-dashed border-(--border) bg-(--card) flex items-center justify-center text-(--muted) hover:bg-(--background) transition"
              >
                <span className="text-2xl leading-none">+</span>
              </Link>
            )}
          </div>
        </SortableContext>
      </DndContext>
      {aiHint && !editing && (
        <p className="mt-1.5 text-xs text-(--muted)">{aiHint}</p>
      )}
    </section>
  );
}
