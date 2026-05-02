"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";
import { cn, formatCurrency, toLocalDateTimeInput } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { Banknote, Landmark, Plane, Users } from "lucide-react";

export type SplitMember = {
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  isYou: boolean;
};

export type TripChoice = {
  id: string;
  name: string;
  icon: string | null;
};

type Props = {
  categories: Category[];
  initial?: {
    id?: string;
    kind: TxKind;
    amount: number;
    categoryId: string | null;
    note: string | null;
    occurredAt: string;
    paymentMethod?: PaymentMethod | null;
    splitWith?: string[];
    /** Existing trip association on the row being edited (or null) */
    tripId?: string | null;
  };
  splitMembers?: SplitMember[];
  /** Active trip in the current session — drives the auto-tag toggle for new tx */
  activeTrip?: TripChoice | null;
  /** All non-archived trips in the current ledger (for the "change trip" picker on edit) */
  trips?: TripChoice[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  submitLabel?: string;
  currency?: string;
};

export function TransactionForm({
  categories,
  initial,
  splitMembers,
  activeTrip,
  trips,
  action,
  submitLabel,
  currency = "THB",
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<TxKind>(initial?.kind ?? "expense");
  const [error, setError] = useState<string | null>(null);

  const youId = splitMembers?.find((m) => m.isYou)?.userId ?? null;
  const initialSelected = new Set<string>(
    initial?.splitWith && initial.splitWith.length > 0
      ? initial.splitWith
      : youId
      ? [youId]
      : []
  );
  const [splitSelected, setSplitSelected] = useState<Set<string>>(initialSelected);
  const [splitOn, setSplitOn] = useState<boolean>(
    Boolean(initial?.splitWith && initial.splitWith.length > 1)
  );
  const [amountInput, setAmountInput] = useState<string>(
    initial?.amount ? String(initial.amount) : ""
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial?.paymentMethod ?? "cash"
  );

  // Trip handling. Three states the form has to express:
  //  - Edit mode for an existing tx with a trip → tripId = that trip's id
  //  - Edit mode without a trip but the user wants to add it → tripId = picked
  //  - New tx with an active trip → default-tagged, user can opt out via toggle
  // We use one piece of state for everything and let the UI branch.
  const initialTripId =
    initial?.tripId ?? (initial ? null : activeTrip?.id ?? null);
  const [tripId, setTripId] = useState<string | null>(initialTripId);

  // datetime-local must be initialized on the client.
  //
  // `toLocalDateTimeInput()` calls Date.getHours() / getMonth() / etc., which return
  // the **runtime's** local time. SSR runs in the server's timezone (UTC on
  // Vercel) — so anything we hardcode into the rendered HTML is in UTC, but
  // the browser displays the string verbatim as if it were the user's local
  // time. A user in Bangkok would see a default that's 7 hours behind reality.
  //
  // Fix: SSR with no value, then fill in on the client via a ref. This
  // applies to BOTH paths:
  //   - new tx: use `now`
  //   - edit tx: format `initial.occurredAt` in the browser's timezone
  const dateRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = dateRef.current;
    if (!el) return;
    el.value = initial?.occurredAt
      ? toLocalDateTimeInput(initial.occurredAt)
      : toLocalDateTimeInput(new Date().toISOString());
  }, [initial?.occurredAt]);

  const visibleCats = categories.filter((c) => c.kind === kind);
  const canSplit = !!splitMembers && splitMembers.length > 1 && kind === "expense";

  const splitIds = Array.from(splitSelected);
  const numAmount = Number(amountInput) || 0;
  const perPerson = splitOn && splitIds.length > 0 ? numAmount / splitIds.length : 0;
  const splitParam = splitOn && splitIds.length > 1 ? splitIds.join(",") : "";

  const submit = submitLabel ?? t("common.save");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // The datetime-local input gives us a TZ-naive string like
        // "2026-05-02T10:30" representing the user's wall-clock time. If we
        // hand that to the server as-is, `new Date(str)` parses it in the
        // server's local TZ (UTC on Vercel) and the recorded instant is off
        // by the user's UTC offset. Convert here in the browser, where
        // `new Date()` parses the string in the user's TZ and serialises
        // back as UTC ISO with a Z suffix the server can trust.
        const occurredAtRaw = fd.get("occurredAt");
        if (typeof occurredAtRaw === "string" && occurredAtRaw.length > 0) {
          const asInstant = new Date(occurredAtRaw);
          if (!Number.isNaN(asInstant.getTime())) {
            fd.set("occurredAt", asInstant.toISOString());
          }
        }
        startTransition(async () => {
          const result = await action(fd);
          if (result && "ok" in result && result.ok === false) {
            setError(result.error);
          }
        });
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-2 gap-2 p-1 bg-(--card) rounded-xl border border-(--border)">
        <input type="hidden" name="kind" value={kind} />
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={cn(
            "py-2.5 rounded-lg text-sm font-medium transition",
            kind === "expense"
              ? "bg-(--expense) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          {t("transactions.kindToggleExpense")}
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={cn(
            "py-2.5 rounded-lg text-sm font-medium transition",
            kind === "income"
              ? "bg-(--income) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          {t("transactions.kindToggleIncome")}
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t("common.amountTHB")}</label>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder={t("transactions.amountPlaceholder")}
          className="w-full px-4 py-3 rounded-xl border border-(--border) bg-(--card) text-2xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-(--accent)"
          autoFocus={!initial}
        />
      </div>

      {canSplit && (
        <div className="rounded-xl border border-(--border) bg-(--card) p-3">
          <input type="hidden" name="splitWith" value={splitParam} />
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Users size={16} className="text-(--accent)" />
              {t("transactions.splitTitle")}
            </span>
            <input
              type="checkbox"
              checked={splitOn}
              onChange={(e) => setSplitOn(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
          </label>

          {splitOn && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-(--muted)">{t("transactions.splitHint")}</p>
              <div className="flex flex-wrap gap-2">
                {splitMembers!.map((m) => {
                  const checked = splitSelected.has(m.userId);
                  return (
                    <label
                      key={m.userId}
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition",
                        checked
                          ? "border-(--accent) bg-(--accent)/10"
                          : "border-(--border) bg-(--background) text-(--muted)"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={m.isYou}
                        onChange={() => {
                          setSplitSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(m.userId)) next.delete(m.userId);
                            else next.add(m.userId);
                            if (youId) next.add(youId);
                            return next;
                          });
                        }}
                      />
                      {m.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image}
                          alt={m.name}
                          className="h-5 w-5 rounded-full"
                        />
                      ) : (
                        <span className="h-5 w-5 rounded-full bg-(--card) border border-(--border) text-[10px] flex items-center justify-center font-semibold">
                          {m.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span>{m.isYou ? `${m.name} (${t("common.you")})` : m.name}</span>
                    </label>
                  );
                })}
              </div>
              {splitIds.length > 1 && perPerson > 0 && (
                <p className="text-xs text-(--muted)">
                  {t("transactions.splitSummary", {
                    count: splitIds.length,
                    amount: formatCurrency(perPerson, currency, fmtLocale),
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trip toggle / picker. Visible whenever:
          - the ledger has at least one non-archived trip, OR
          - this row is currently tagged to a (possibly archived) trip,
            so the user can detach or change it explicitly.
          New tx with an active trip gets a friendly toggle; everything
          else gets a dropdown so old rows can be tagged or retagged
          freely. */}
      {((trips && trips.length > 0) || initial?.tripId) && (
        <div className="rounded-xl border border-(--border) bg-(--card) p-3">
          <input type="hidden" name="tripId" value={tripId ?? ""} />
          {!initial && activeTrip ? (
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Plane size={16} className="text-(--accent)" />
                {t("trips.addToTripLabel", {
                  name: `${activeTrip.icon ?? "✈️"} ${activeTrip.name}`,
                })}
              </span>
              <input
                type="checkbox"
                checked={tripId === activeTrip.id}
                onChange={(e) =>
                  setTripId(e.target.checked ? activeTrip.id : null)
                }
                className="h-4 w-4 accent-[var(--accent)]"
              />
            </label>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium flex items-center gap-2">
                <Plane size={16} className="text-(--accent)" />
                {t("trips.tripField")}
              </label>
              <select
                value={tripId ?? ""}
                onChange={(e) => setTripId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) text-sm"
              >
                <option value="">{t("trips.noTrip")}</option>
                {/* Active trips — what the user can newly assign to. */}
                {trips?.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {(tr.icon ?? "✈️") + " " + tr.name}
                  </option>
                ))}
                {/* If the row's current trip isn't in the active list
                    (e.g. archived after the fact), surface it so the
                    selection stays correct + the user can detach. */}
                {initial?.tripId &&
                  !trips?.some((tr) => tr.id === initial.tripId) && (
                    <option value={initial.tripId}>
                      {t("trips.archivedTripOption")}
                    </option>
                  )}
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1.5">{t("common.category")}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleCats.map((c) => (
            <CategoryRadio
              key={c.id}
              category={c}
              defaultChecked={initial?.categoryId === c.id}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("transactions.paymentMethod")}
        </label>
        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <div className="grid grid-cols-2 gap-2 p-1 bg-(--card) rounded-xl border border-(--border)">
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition",
              paymentMethod === "cash"
                ? "bg-(--accent) text-(--accent-foreground)"
                : "text-(--muted) hover:text-(--foreground)"
            )}
          >
            <Banknote size={16} />
            {t("transactions.paymentCash")}
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("transfer")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition",
              paymentMethod === "transfer"
                ? "bg-(--accent) text-(--accent-foreground)"
                : "text-(--muted) hover:text-(--foreground)"
            )}
          >
            <Landmark size={16} />
            {t("transactions.paymentTransfer")}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">{t("common.dateTime")}</label>
        <input
          ref={dateRef}
          name="occurredAt"
          type="datetime-local"
          required
          // Intentionally no defaultValue — see useEffect above. The browser's
          // `required` validation only fires on submit, by which time the
          // effect has populated the value.
          suppressHydrationWarning
          className="w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--card) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("common.noteOptional")}
        </label>
        <input
          name="note"
          type="text"
          maxLength={500}
          defaultValue={initial?.note ?? ""}
          placeholder={t("transactions.noteHint")}
          className="w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--card) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) transition font-medium"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-[2] px-4 py-3 rounded-xl bg-(--accent) text-(--accent-foreground) font-semibold disabled:opacity-50 cta-primary"
        >
          {pending ? t("common.saving") : submit}
        </button>
      </div>
    </form>
  );
}

function CategoryRadio({
  category,
  defaultChecked,
}: {
  category: Category;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="categoryId"
        value={category.id}
        defaultChecked={defaultChecked}
        className="peer sr-only"
        required
      />
      <div className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) transition peer-checked:border-(--accent) peer-checked:bg-(--accent)/5 peer-checked:ring-2 peer-checked:ring-(--accent)/30">
        <span className="text-2xl">{category.icon ?? "✨"}</span>
        <span className="text-xs font-medium">{category.name}</span>
      </div>
    </label>
  );
}
