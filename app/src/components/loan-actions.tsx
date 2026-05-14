"use client";

import { useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";

import type { LoanStatus } from "@/lib/types";

type Labels = {
  settle: string;
  reopen: string;
  delete: string;
  settleConfirm: string;
  deleteConfirm: string;
  working: string;
};

export function LoanActions({
  status,
  onSettle,
  onReopen,
  onDelete,
  labels,
}: {
  loanId: string;
  status: LoanStatus;
  onSettle: () => Promise<void>;
  onReopen: () => Promise<void>;
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
      {status === "open" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(labels.settleConfirm)) return;
            run(onSettle);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-(--income) text-white px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          <JtIcon name="check-circle-2" size={18} />
          {pending ? labels.working : labels.settle}
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(onReopen)}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <JtIcon name="rotate-ccw" size={18} />
          {pending ? labels.working : labels.reopen}
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
