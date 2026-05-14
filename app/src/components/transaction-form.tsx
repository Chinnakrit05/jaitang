"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";
import { cn, formatCurrency, toLocalDateTimeInput } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

import { CurrencyPicker } from "@/components/currency-picker";
import { getFxRateAction } from "@/app/(app)/transactions/fx-actions";
import { suggestCategoryAction } from "@/app/(app)/transactions/categorize-action";

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
  /** Trip's native currency. Drives the form's currency default when this
   *  trip is active. null = inherit ledger.currency. */
  currency: string | null;
};

export type AccountChoice = {
  id: string;
  name: string;
  icon: string | null;
  /** Account's currency, already resolved (null → ledger home). */
  currency: string;
  archived: boolean;
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
    /** Existing account association on the row being edited (or null) */
    accountId?: string | null;
    /** Existing FX state on the row being edited */
    fxCurrency?: string | null;
    fxAmount?: number | null;
    fxRate?: number | null;
  };
  splitMembers?: SplitMember[];
  /** Active trip in the current session — drives the auto-tag toggle for new tx */
  activeTrip?: TripChoice | null;
  /** All non-archived trips in the current ledger (for the "change trip" picker on edit) */
  trips?: TripChoice[];
  /** All accounts (incl. archived) in the current ledger. Filtered by tx
   *  currency before display. */
  accounts?: AccountChoice[];
  /** Past tx notes for the note-input autocomplete (datalist). Already
   *  deduped + frequency-ranked by the server. */
  noteSuggestions?: string[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  submitLabel?: string;
  /** Ledger's home currency. Used for FX preview formatting. */
  currency?: string;
};

export function TransactionForm({
  categories,
  initial,
  splitMembers,
  activeTrip,
  trips,
  accounts,
  noteSuggestions,
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
  const [noteInput, setNoteInput] = useState<string>(initial?.note ?? "");
  // Auto-categorize state. `loading` while the AI call is in flight,
  // `error` if it failed, `confidence` so we can show a soft hint when
  // the model wasn't sure (low/medium → user should double-check).
  const [aiCategorize, setAiCategorize] = useState<{
    loading: boolean;
    error: string | null;
    confidence: "high" | "medium" | "low" | null;
  }>({ loading: false, error: null, confidence: null });
  const formRef = useRef<HTMLFormElement>(null);
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

  // Account picker state. Defaults to whatever this row already has, or
  // null. Auto-clear if the chosen account's currency stops matching
  // the form's tx currency (otherwise the row would silently drop out
  // of the account's balance computation).
  const [accountId, setAccountId] = useState<string | null>(
    initial?.accountId ?? null
  );

  // FX state. Three sources for the default currency, in priority order:
  //   1. Existing row's fx_currency (edit mode preserving original)
  //   2. Active trip's currency (new-tx flow during a foreign trip)
  //   3. Ledger's home currency (everyday domestic case)
  const homeCurrency = currency;
  const initialCurrency =
    initial?.fxCurrency ??
    (initial ? null : activeTrip?.currency && activeTrip.currency !== homeCurrency
      ? activeTrip.currency
      : null) ??
    homeCurrency;
  const [txCurrency, setTxCurrency] = useState<string>(initialCurrency);
  // Live preview rate fetched from the server when a foreign currency is
  // selected. Null → loading / not-yet-fetched. The actual stored rate is
  // re-fetched in the server action — this is just for the preview hint.
  const [previewRate, setPreviewRate] = useState<number | null>(
    initial?.fxRate ?? null
  );
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Debounced rate refresh: when the user picks a non-home currency,
  // fetch a fresh rate after they pause typing. Setting state inside
  // an effect is the right call here — we *are* synchronizing local
  // state with an external system (the FX provider). The lint rule
  // flags it because it can't tell that intent apart from cascading
  // renders.
  useEffect(() => {
    if (txCurrency === homeCurrency) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewRate(null);
      setPreviewError(null);
      return;
    }
    setPreviewError(null);
    const t = setTimeout(async () => {
      const result = await getFxRateAction(txCurrency, homeCurrency);
      if (result.ok) {
        setPreviewRate(result.rate);
      } else {
        setPreviewError(result.error);
        setPreviewRate(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [txCurrency, homeCurrency]);

  // Auto-detach account when its currency stops matching the form. The
  // listAccounts balance math skips currency-mismatched rows, so silent
  // mismatches would just hide the row from the headline number — better
  // to surface it by detaching here.
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
  // For split: the "per person" value is computed in HOME currency so it
  // matches everything else on the form. When the form is in foreign
  // currency, we use the previewed home amount; otherwise the entered
  // amount IS already home.
  const homeAmountForSplit =
    txCurrency === homeCurrency ? numAmt : previewHomeAmount ?? 0;
  const perPerson =
    splitOn && splitIds.length > 0 ? homeAmountForSplit / splitIds.length : 0;
  const splitParam = splitOn && splitIds.length > 1 ? splitIds.join(",") : "";

  const submit = submitLabel ?? t("common.save");

  /**
   * Ask the AI for a category given the current note + kind. Selects
   * the suggested radio programmatically. We don't change the radio
   * markup (still uncontrolled with `defaultChecked`) — `.click()`
   * triggers the browser's native checked-state update, which is
   * what the form serializer actually reads at submit time.
   */
  async function runCategorizeSuggest() {
    const note = noteInput.trim();
    if (!note) return;
    setAiCategorize({ loading: true, error: null, confidence: null });
    const result = await suggestCategoryAction({ note, kind });
    if (result.ok === false) {
      setAiCategorize({ loading: false, error: result.error, confidence: null });
      return;
    }
    if (result.categoryId) {
      const radio = formRef.current?.querySelector<HTMLInputElement>(
        `input[name="categoryId"][value="${result.categoryId}"]`
      );
      radio?.click();
    }
    setAiCategorize({
      loading: false,
      error: result.categoryId ? null : t("transactions.aiCategorizeNoMatch"),
      confidence: result.confidence,
    });
  }

  return (
    <form
      ref={formRef}
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
        <label className="block text-sm font-medium mb-1.5">
          {t("common.amount")}
        </label>
        {/* hidden field so server gets the chosen currency */}
        <input type="hidden" name="fxCurrency" value={txCurrency} />
        <div className="flex gap-2">
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
            className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-(--border) bg-(--card) text-2xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-(--accent)"
            autoFocus={!initial}
          />
          <CurrencyPicker
            value={txCurrency}
            onChange={setTxCurrency}
            ariaLabel="currency"
            className="px-3 py-3 text-sm font-medium"
          />
        </div>
        {txCurrency !== homeCurrency && (
          <div className="mt-1.5 text-xs text-(--muted)">
            {previewError ? (
              <span className="text-(--expense)">
                {t("transactions.fxError")}
              </span>
            ) : previewHomeAmount !== null ? (
              <span>
                ≈{" "}
                <span className="text-(--foreground) font-medium tabular-nums">
                  {formatCurrency(previewHomeAmount, homeCurrency, fmtLocale)}
                </span>{" "}
                <span className="text-(--muted)">
                  (
                  {t("transactions.fxRateLine", {
                    rate: previewRate?.toFixed(4) ?? "—",
                    from: txCurrency,
                  })}
                  )
                </span>
              </span>
            ) : (
              <span className="opacity-60">
                {t("transactions.fxFetching")}
              </span>
            )}
          </div>
        )}
      </div>

      {canSplit && (
        <div className="rounded-xl border border-(--border) bg-(--card) p-3">
          <input type="hidden" name="splitWith" value={splitParam} />
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-medium">
              <JtIcon name="users" size={16} className="text-(--accent)" />
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
                <JtIcon name="trips" size={16} className="text-(--accent)" />
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
                <JtIcon name="trips" size={16} className="text-(--accent)" />
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

      {/* Account picker. Only render when the ledger has any accounts;
          options are filtered to those whose currency matches the form's
          tx currency (since balance math only counts matching-currency
          rows). The currently-tagged account is always surfaced even if
          it doesn't match — so the user can detach explicitly. */}
      {((accounts && accounts.length > 0) || initial?.accountId) && (() => {
        const eligible = (accounts ?? []).filter(
          (a) => a.currency === txCurrency && !a.archived
        );
        const taggedNotInList =
          initial?.accountId &&
          !(accounts ?? []).some((a) => a.id === initial.accountId);
        return (
          <div className="rounded-xl border border-(--border) bg-(--card) p-3">
            <input type="hidden" name="accountId" value={accountId ?? ""} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium flex items-center gap-2">
                <JtIcon name="accounts" size={16} className="text-(--accent)" />
                {t("accounts.accountField")}
              </label>
              <select
                value={accountId ?? ""}
                onChange={(e) => setAccountId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) text-sm"
              >
                <option value="">{t("accounts.noAccount")}</option>
                {eligible.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.icon ?? "💰") + " " + a.name}
                  </option>
                ))}
                {/* Surface a tagged-but-mismatched account so the user can
                    detach it explicitly rather than have it silently dropped. */}
                {accountId &&
                  !eligible.some((a) => a.id === accountId) && (
                    <option value={accountId}>
                      {(accounts ?? []).find((a) => a.id === accountId)
                        ?.name ?? t("accounts.unavailableAccountOption")}{" "}
                      ({t("accounts.currencyMismatchOption")})
                    </option>
                  )}
                {taggedNotInList && (
                  <option value={initial.accountId!}>
                    {t("accounts.unavailableAccountOption")}
                  </option>
                )}
              </select>
              {eligible.length === 0 && (
                <p className="text-[11px] text-(--muted)">
                  {t("accounts.noMatchingCurrency", { currency: txCurrency })}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium">{t("common.category")}</label>
          {/* AI suggest — only useful when there's a note to read. We
              keep the button visible (just disabled) to teach the
              feature; tooltip explains why it's off. */}
          <button
            type="button"
            onClick={runCategorizeSuggest}
            disabled={
              aiCategorize.loading || noteInput.trim().length === 0
            }
            title={
              noteInput.trim().length === 0
                ? t("transactions.aiCategorizeNeedsNote")
                : t("transactions.aiCategorizeHint")
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-(--accent) hover:bg-(--accent)/10 px-2 py-1 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <JtIcon name="sparkles"
              size={13}
              className={aiCategorize.loading ? "animate-pulse" : ""}
            />
            {aiCategorize.loading
              ? t("transactions.aiCategorizeLoading")
              : t("transactions.aiCategorizeButton")}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleCats.map((c) => (
            <CategoryRadio
              key={c.id}
              category={c}
              defaultChecked={initial?.categoryId === c.id}
            />
          ))}
        </div>
        {aiCategorize.error && (
          <p className="mt-1.5 text-xs text-(--muted)">
            {aiCategorize.error}
          </p>
        )}
        {aiCategorize.confidence === "low" && !aiCategorize.error && (
          <p className="mt-1.5 text-xs text-(--muted)">
            {t("transactions.aiCategorizeLowConfidence")}
          </p>
        )}
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
            <JtIcon name="banknote" size={16} />
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
            <JtIcon name="landmark" size={16} />
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
        {/* `list=` + <datalist> gives us native autocomplete in every
            modern browser (incl. mobile). The browser handles
            substring matching as the user types — no custom dropdown
            JS needed. We feed the user's past notes ranked by usage
            frequency from listDistinctNotes(). */}
        <input
          name="note"
          type="text"
          maxLength={500}
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder={t("transactions.noteHint")}
          list={
            noteSuggestions && noteSuggestions.length > 0
              ? "tx-note-suggestions"
              : undefined
          }
          autoComplete="off"
          className="w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--card) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
        {noteSuggestions && noteSuggestions.length > 0 && (
          <datalist id="tx-note-suggestions">
            {noteSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
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
