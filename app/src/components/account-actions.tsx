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
 * Archive / unarchive / delete buttons at the bottom of the account
 * detail page. Server actions are bound to the account id on the server
 * side and passed in as already-bound functions — same pattern as
 * TripActions.
 *
 * Delete is the destructive option: tagged transactions get account_id
 * set to null (FK on delete set null) and transfers cascade-delete. The
 * confirm string spells that out for the user.
 */
export function AccountActions({
  archived,
  onArchive,
  onUnarchive,
  onDelete,
  labels,
}: {
  accountId: string;
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
          <JtIcon name="archive" size={14} />
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
          <JtIcon name="archive-restore" size={14} />
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
        <JtIcon name="trash2" size={14} />
        {labels.delete}
      </button>
    </div>
  );
}
