"use client";


import { useRouter } from "next/navigation";
import { JtIcon } from "@/components/icons";
import { useTransition } from "react";
import { useTranslations } from "next-intl";

export function DeleteForm({
  deleteAction,
}: {
  id: string;
  deleteAction: () => Promise<void>;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(t("transactions.deleteConfirmHard"))) return;
        startTransition(async () => {
          await deleteAction();
          router.push("/transactions");
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-2 text-sm text-(--expense) hover:underline disabled:opacity-50"
    >
      <JtIcon name="trash2" size={20} />
      {t("transactions.deleteThisItem")}
    </button>
  );
}
