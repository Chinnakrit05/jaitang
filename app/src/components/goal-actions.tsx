"use client";

import { useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";


type Labels = {
  archive: string;
  unarchive: string;
  delete: string;
  archiveConfirm: string;
  deleteConfirm: string;
  working: string;
};

/**
 * Bottom-of-detail-card actions: archive / unarchive / delete. Mirrors
 * the trip-actions component's structure so users have a consistent
 * destructive-flow experience.
 */
export function GoalActions({
  archived,
  onArchive,
  onUnarchive,
  onDelete,
  labels,
}: {
  goalId: string;
  archived: boolean;
  onArchive: () => Promise<void>;
  onUnarchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-(--border)">
      {!archived && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(labels.archiveConfirm)) return;
            run(onArchive);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <JtIcon name="archive" size={18} />
          {pending ? labels.working : labels.archive}
        </button>
      )}
      {archived && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(onUnarchive)}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <JtIcon name="archive-restore" size={18} />
          {pending ? labels.working : labels.unarchive}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(labels.deleteConfirm)) return;
          run(onDelete);
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-(--expense)/40 bg-(--expense)/10 text-(--expense) hover:bg-(--expense)/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        <JtIcon name="trash2" size={18} />
        {labels.delete}
      </button>
    </div>
  );
}
