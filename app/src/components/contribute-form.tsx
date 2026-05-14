"use client";

import { useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { addContributionAction } from "@/app/(app)/goals/actions";

/**
 * Quick "save money to this goal" form embedded in the goal detail
 * header. Just an amount + optional note. Submitting refreshes server
 * components so the progress bar + AI nudge above stay in sync.
 */
export function ContributeForm({
  goalId,
  currency,
}: {
  goalId: string;
  currency: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (!amount.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("amount", amount);
    if (note.trim()) fd.set("note", note);
    startTransition(async () => {
      const result = await addContributionAction(goalId, fd);
      if (result && "ok" in result && result.ok === false) {
        setError(result.error);
        return;
      }
      setAmount("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-2.5"
    >
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <JtIcon name="plus-fab" size={14} />
        {t("goals.contributeTitle")}
      </h3>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("goals.contributeAmountPlaceholder", { currency })}
          className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-(--border) bg-(--background) text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
        <button
          type="submit"
          disabled={pending || !amount.trim()}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
        >
          {pending ? t("common.saving") : t("goals.contributeButton")}
        </button>
      </div>
      <input
        type="text"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("goals.contributeNotePlaceholder")}
        className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
      />
      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </form>
  );
}
