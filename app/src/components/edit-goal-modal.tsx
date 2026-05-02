"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, X } from "lucide-react";
import { cn, toLocalDateTimeInput } from "@/lib/utils";
import { updateGoalDetailsAction } from "@/app/(app)/goals/actions";
import type { Goal } from "@/lib/types";

const ICON_CHOICES = ["🎯", "✈️", "🏖️", "🏠", "🚗", "💍", "🎓", "💻", "🎮", "🛒"];
const COLOR_CHOICES = [
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
  "#64748b",
];

/**
 * Edit-goal modal. Mirrors EditTripModal — same UX language so users
 * who learned to edit trips don't have to re-learn the flow.
 */
export function EditGoalModal({
  goal,
  ledgerCurrency,
}: {
  goal: Goal;
  ledgerCurrency: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(goal.name);
  const [icon, setIcon] = useState(goal.icon ?? "🎯");
  const [color, setColor] = useState(goal.color ?? "#10b981");
  const [target, setTarget] = useState(String(goal.target_amount));
  const [deadline, setDeadline] = useState(
    goal.deadline ? toLocalDateTimeInput(goal.deadline) : ""
  );

  function openModal() {
    setName(goal.name);
    setIcon(goal.icon ?? "🎯");
    setColor(goal.color ?? "#10b981");
    setTarget(String(goal.target_amount));
    setDeadline(goal.deadline ? toLocalDateTimeInput(goal.deadline) : "");
    setError(null);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("icon", icon);
    fd.set("color", color);
    fd.set("targetAmount", target);
    if (deadline) {
      const inst = new Date(deadline);
      if (!Number.isNaN(inst.getTime())) {
        fd.set("deadline", inst.toISOString());
      }
    }
    startTransition(async () => {
      const result = await updateGoalDetailsAction(goal.id, fd);
      if (result && "ok" in result && result.ok === false) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label={t("goals.editGoal")}
        title={t("goals.editGoal")}
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium transition"
      >
        <Pencil size={14} />
        <span className="hidden sm:inline">{t("goals.editGoal")}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,440px)] max-h-[85vh] overflow-y-auto rounded-2xl bg-(--card) border border-(--border) shadow-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">{t("goals.editGoal")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-(--muted) hover:bg-(--background)"
                aria-label="close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("goals.namePlaceholder")}
                className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-(--muted) mb-1">
                    {t("goals.targetLabel", { currency: ledgerCurrency })}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-(--muted) mb-1">
                    {t("goals.deadlineLabelOptional")}
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--background) text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-(--muted) mb-1.5">
                  {t("goals.iconLabel")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_CHOICES.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={cn(
                        "h-9 w-9 rounded-lg border text-lg flex items-center justify-center transition",
                        icon === ic
                          ? "border-(--accent) bg-(--accent)/10"
                          : "border-(--border) bg-(--background) hover:bg-(--card)"
                      )}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-(--muted) mb-1.5">
                  {t("goals.colorLabel")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={c}
                      style={{ backgroundColor: c }}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition",
                        color === c
                          ? "border-(--foreground)"
                          : "border-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || !name.trim()}
                  className="flex-[2] px-4 py-2.5 rounded-xl bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 cta-primary"
                >
                  {pending ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
