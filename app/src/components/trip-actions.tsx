"use client";

import { useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";


type Labels = {
  setActive: string;
  archive: string;
  unarchive: string;
  delete: string;
  archiveConfirm: string;
  deleteConfirm: string;
  working: string;
};

/**
 * Action buttons row at the bottom of the trip header. The mutation
 * functions are bound on the server (via `setActiveTripAction.bind(null, id)`
 * etc.) before being passed down — `"use client"` boundaries can't bind
 * extra arguments to server actions on this side.
 */
export function TripActions({
  archived,
  isActive,
  onSetActive,
  onArchive,
  onUnarchive,
  onDelete,
  labels,
}: {
  tripId: string;
  archived: boolean;
  isActive: boolean;
  onSetActive: () => Promise<void>;
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
      {!archived && !isActive && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(onSetActive)}
          className="inline-flex items-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          <JtIcon name="trips" size={18} />
          {labels.setActive}
        </button>
      )}
      {!archived && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(labels.archiveConfirm)) return;
            run(onArchive);
          }}
          className="inline-flex items-center gap-2 rounded-[16px] soft-raised hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
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
          className="inline-flex items-center gap-2 rounded-[16px] soft-raised hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
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
