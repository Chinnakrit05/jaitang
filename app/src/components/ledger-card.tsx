"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Settings } from "lucide-react";
import type { LedgerSummary } from "@/lib/ledgers";
import { switchLedgerAction } from "@/app/(app)/ledgers/actions";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของ",
  editor: "ร่วมจด",
  viewer: "ดูอย่างเดียว",
};

export function LedgerCard({
  ledger,
  isActive,
}: {
  ledger: LedgerSummary;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function activate() {
    if (isActive || pending) return;
    startTransition(async () => {
      await switchLedgerAction(ledger.id);
      router.refresh();
      router.push("/dashboard");
    });
  }

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 transition cursor-pointer relative",
        isActive
          ? "border-(--accent) bg-(--accent)/5 ring-2 ring-(--accent)/30"
          : "border-(--border) bg-(--card) hover:bg-(--background)",
        pending && "opacity-50"
      )}
      onClick={activate}
    >
      <div className="flex items-start gap-3">
        <span
          className="text-3xl shrink-0"
          style={{ filter: pending ? "grayscale(1)" : undefined }}
        >
          {ledger.icon ?? "📒"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{ledger.name}</div>
          <div className="text-xs text-(--muted) flex items-center gap-2 mt-0.5">
            <span>{ledger.is_personal ? "สมุดส่วนตัว" : "สมุดแชร์"}</span>
            <span>•</span>
            <span>{ROLE_LABEL[ledger.role]}</span>
          </div>
        </div>
        {isActive && <Check size={18} className="text-(--accent) shrink-0" />}
      </div>

      {!ledger.is_personal && ledger.role === "owner" && (
        <Link
          href={`/ledgers/${ledger.id}/members`}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-3 text-(--muted) hover:text-(--foreground) p-1 rounded-md hover:bg-(--card)"
          aria-label="จัดการสมาชิก"
        >
          <Settings size={16} />
        </Link>
      )}
    </li>
  );
}
