"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteForm({
  deleteAction,
}: {
  id: string;
  deleteAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("ลบรายการนี้ ไม่สามารถกู้คืนได้")) return;
        startTransition(async () => {
          await deleteAction();
          router.push("/transactions");
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-2 text-sm text-(--expense) hover:underline disabled:opacity-50"
    >
      <Trash2 size={16} />
      ลบรายการนี้
    </button>
  );
}
