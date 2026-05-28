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
      className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold bg-(--expense)/10 text-(--expense) border border-(--expense)/25 shadow-sm hover:bg-(--expense)/15 hover:border-(--expense)/40 hover:shadow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      <JtIcon name="trash2" size={18} />
      {pending ? t("common.saving") : t("transactions.deleteThisItem")}
    </button>
  );
}
