"use client";

import { useState, useTransition } from "react";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";

import type { LedgerSummary } from "@/lib/ledgers";
import {
  renameLedgerAction,
  switchLedgerAction,
} from "@/app/(app)/ledgers/actions";
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
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(ledger.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingRename, startSavingRename] = useTransition();
  const ROLE_LABEL: Record<string, string> = {
    owner: t("ledgers.roleOwner"),
    editor: t("ledgers.roleEditor"),
    viewer: t("ledgers.roleViewer"),
  };

  function activate() {
    if (isActive || pending || renaming) return;
    startTransition(async () => {
      await switchLedgerAction(ledger.id);
      router.refresh();
      router.push("/dashboard");
    });
  }

  function commitRename() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === ledger.name) {
      setRenaming(false);
      setName(ledger.name);
      return;
    }
    startSavingRename(async () => {
      const result = await renameLedgerAction(ledger.id, trimmed);
      if (result.ok === false) {
        setRenameError(result.error);
        return;
      }
      setRenaming(false);
      setRenameError(null);
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 transition relative",
        renaming ? "cursor-default" : "cursor-pointer",
        isActive
          ? "border-(--accent) bg-(--accent)/5 ring-2 ring-(--accent)/30"
          : "border-(--border) bg-(--card) hover:bg-(--background)",
        pending && "opacity-50"
      )}
      onClick={activate}
    >
      <div className="flex items-start gap-3">
        <span
          className="shrink-0"
          style={{ filter: pending ? "grayscale(1)" : undefined }}
        >
          <EmojiOrIcon value={ledger.icon} fallback="users" size={32} />
        </span>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename();
                  }
                  if (e.key === "Escape") {
                    setName(ledger.name);
                    setRenameError(null);
                    setRenaming(false);
                  }
                }}
                maxLength={60}
                disabled={savingRename}
                className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-(--border) bg-(--background) text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-(--accent)/50"
              />
              <button
                type="button"
                onClick={commitRename}
                disabled={savingRename}
                className="p-1.5 rounded-lg text-(--income) hover:bg-(--income)/10 disabled:opacity-50"
                aria-label={t("common.save")}
              >
                {savingRename ? (
                  <JtIcon name="loader-2" size={18} className="animate-spin" />
                ) : (
                  <JtIcon name="check" size={18} />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(ledger.name);
                  setRenameError(null);
                  setRenaming(false);
                }}
                disabled={savingRename}
                className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) disabled:opacity-50"
                aria-label={t("common.cancel")}
              >
                <JtIcon name="x" size={18} />
              </button>
            </div>
          ) : (
            <div className="font-semibold truncate">{ledger.name}</div>
          )}
          {renameError && (
            <div className="text-[11px] text-(--expense) mt-1">{renameError}</div>
          )}
          <div className="text-xs text-(--muted) flex items-center gap-2 mt-0.5">
            <span>{ledger.is_personal ? t("ledgers.personal") : t("ledgers.shared")}</span>
            <span>•</span>
            <span>{ROLE_LABEL[ledger.role]}</span>
          </div>
        </div>
        {!renaming && isActive && (
          <JtIcon name="check" size={22} className="text-(--accent) shrink-0" />
        )}
      </div>

      {/* Owner-only controls (rename + members). Both stop click
          propagation so they don't also fire the card's switch-to
          handler. Hidden while the rename input is open to avoid
          competing tap targets. */}
      {ledger.role === "owner" && !renaming && (
        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setName(ledger.name);
              setRenameError(null);
              setRenaming(true);
            }}
            className="text-(--muted) hover:text-(--foreground) p-1 rounded-md hover:bg-(--card)"
            aria-label={t("common.edit")}
            title={t("common.edit")}
          >
            <JtIcon name="pencil" size={18} />
          </button>
          <Link
            href={`/ledgers/${ledger.id}/members`}
            onClick={(e) => e.stopPropagation()}
            className="text-(--muted) hover:text-(--foreground) p-1 rounded-md hover:bg-(--card)"
            aria-label={t("members.subtitle")}
          >
            <JtIcon name="settings" size={18} />
          </Link>
        </div>
      )}
    </li>
  );
}
