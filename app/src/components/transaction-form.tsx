"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { Category, TxKind } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";
import { Users } from "lucide-react";

export type SplitMember = {
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  isYou: boolean;
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
    splitWith?: string[];
  };
  splitMembers?: SplitMember[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  submitLabel?: string;
  currency?: string;
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function TransactionForm({
  categories,
  initial,
  splitMembers,
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

  const visibleCats = categories.filter((c) => c.kind === kind);
  const canSplit = !!splitMembers && splitMembers.length > 1 && kind === "expense";

  const splitIds = Array.from(splitSelected);
  const numAmount = Number(amountInput) || 0;
  const perPerson = splitOn && splitIds.length > 0 ? numAmount / splitIds.length : 0;
  const splitParam = splitOn && splitIds.length > 1 ? splitIds.join(",") : "";

  const defaultDate = initial?.occurredAt
    ? toLocalInput(initial.occurredAt)
    : toLocalInput(new Date().toISOString());

  const submit = submitLabel ?? t("common.save");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
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
        <label className="block text-sm font-medium mb-1.5">{t("common.dateTime")}</label>
        <input
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={defaultDate}
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
          className="flex-[2] px-4 py-3 rounded-xl bg-(--accent) text-(--accent-foreground) font-semibold hover:opacity-90 transition disabled:opacity-50"
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
