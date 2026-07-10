"use client";

import { useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Inline delete button for a report row. Wraps a server-action prop
 * so the parent can bind whichever id-scoped delete (transaction or
 * recurring rule) belongs to the row. Confirms before firing so an
 * accidental tap doesn't nuke an entry.
 */
/**
 * Pause button for a recurring-rule row. Replaces the old trash button
 * on /reports — a report row is something people skim past monthly, so
 * the destructive "delete the whole rule" action doesn't belong there.
 * Pausing just flips `active` off; the rule keeps its schedule and can
 * be re-enabled any time from /recurring.
 */
export function PauseRuleButton({ action }: { action: () => Promise<unknown> }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm(t("recurring.pauseConfirm"))) return;
        startTransition(async () => {
          await action();
        });
      }}
      disabled={pending}
      aria-label={t("recurring.pauseLabel")}
      title={t("recurring.pauseLabel")}
      className={cn(
        "p-1 rounded-md text-(--muted) hover:bg-(--accent)/10 hover:text-(--accent) transition shrink-0",
        pending && "opacity-50"
      )}
    >
      {pending ? (
        <JtIcon name="loader-2" size={14} className="animate-spin" />
      ) : (
        <JtIcon name="pause" size={14} />
      )}
    </button>
  );
}

export function DeleteRowButton({
  action,
  confirmKey = "transactions.deleteConfirm",
}: {
  action: () => Promise<unknown>;
  /** i18n key for the confirmation prompt. */
  confirmKey?: string;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm(t(confirmKey))) return;
        startTransition(async () => {
          await action();
        });
      }}
      disabled={pending}
      aria-label={t("common.delete")}
      title={t("common.delete")}
      className={cn(
        "p-1 rounded-md text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense) transition shrink-0",
        pending && "opacity-50"
      )}
    >
      {pending ? (
        <JtIcon name="loader-2" size={14} className="animate-spin" />
      ) : (
        <JtIcon name="trash2" size={14} />
      )}
    </button>
  );
}
