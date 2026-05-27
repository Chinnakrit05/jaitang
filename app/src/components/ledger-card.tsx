"use client";

import { useTransition } from "react";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { LedgerSummary } from "@/lib/ledgers";
import { switchLedgerAction } from "@/app/(app)/ledgers/actions";
import { cn } from "@/lib/utils";

export function LedgerCard({
  ledger,
  isActive,
}: {
  ledger: LedgerSummary;
  isActive: boolean;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const ROLE_LABEL: Record<string, string> = {
    owner: t("ledgers.roleOwner"),
    editor: t("ledgers.roleEditor"),
    viewer: t("ledgers.roleViewer"),
  };

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
        "rounded-2xl border p-4 transition",
        isActive
          ? "border-(--accent) bg-(--accent)/5 ring-2 ring-(--accent)/30"
          : "border-(--border) bg-(--card)",
        pending && "opacity-50"
      )}
    >
      {/* Identity row — icon + name + role. Plain block, no longer
          serves as a tap target so the action buttons below own the
          clicks unambiguously. */}
      <div className="flex items-start gap-3">
        <span
          className="shrink-0"
          style={{ filter: pending ? "grayscale(1)" : undefined }}
        >
          <EmojiOrIcon value={ledger.icon} fallback="users" size={32} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{ledger.name}</div>
          <div className="text-xs text-(--muted) flex items-center gap-2 mt-0.5">
            <span>{ledger.is_personal ? t("ledgers.personal") : t("ledgers.shared")}</span>
            <span>•</span>
            <span>{ROLE_LABEL[ledger.role]}</span>
          </div>
        </div>
        {isActive && (
          <JtIcon name="check" size={22} className="text-(--accent) shrink-0" />
        )}
      </div>

      {/* Action row — explicit buttons instead of the old overlapping
          icons in the corner. Layout:
            [ ใช้งาน (or ใช้อยู่)              ]  [ แก้ไข ] [ สมาชิก ]
          Non-owners only see "ใช้งาน". */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={activate}
          disabled={isActive || pending}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition",
            isActive
              ? "bg-(--accent)/10 text-(--accent) cursor-default"
              : "bg-(--accent) text-(--accent-foreground) hover:opacity-90 disabled:opacity-50"
          )}
        >
          {isActive ? t("ledgers.inUse") : t("ledgers.useLedger")}
        </button>
        {ledger.role === "owner" && (
          <>
            <Link
              href={`/ledgers/${ledger.id}/edit`}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium transition"
              aria-label={t("common.edit")}
            >
              <JtIcon name="pencil" size={16} />
              <span className="hidden sm:inline">{t("common.edit")}</span>
            </Link>
            <Link
              href={`/ledgers/${ledger.id}/members`}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium transition"
              aria-label={t("members.subtitle")}
            >
              <JtIcon name="users" size={16} />
              <span className="hidden sm:inline">{t("ledgers.members")}</span>
            </Link>
          </>
        )}
      </div>
    </li>
  );
}
