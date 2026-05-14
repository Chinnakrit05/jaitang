"use client";

import { useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";

import { deleteRepaymentAction } from "@/app/(app)/loans/actions";

export function DeleteRepaymentButton({
  repaymentId,
  confirmLabel,
  aria,
}: {
  repaymentId: string;
  confirmLabel: string;
  aria: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(confirmLabel)) return;
        startTransition(async () => {
          await deleteRepaymentAction(repaymentId);
          router.refresh();
        });
      }}
      // Always visible on mobile (no hover); fade-in on desktop on row hover.
      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense) transition disabled:opacity-50"
      aria-label={aria}
      title={aria}
    >
      <JtIcon name="trash2" size={14} />
    </button>
  );
}
