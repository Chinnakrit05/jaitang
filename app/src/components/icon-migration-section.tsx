"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";
import {
  applyIconMigrationAction,
  proposeIconMigrationAction,
} from "@/app/(app)/settings/icon-migration-action";
import type {
  IconMigrationChange,
  IconMigrationKind,
} from "@/lib/icon-migration";

type Row = IconMigrationChange & { keep: boolean };

const KIND_LABEL_KEY: Record<IconMigrationKind, string> = {
  category: "settings.iconMigration.kindCategory",
  account: "settings.iconMigration.kindAccount",
  trip: "settings.iconMigration.kindTrip",
  goal: "settings.iconMigration.kindGoal",
  ledger: "settings.iconMigration.kindLedger",
};

/**
 * One-off converter for rows still holding an emoji.
 *
 * Nothing runs until the user asks, and nothing is written until they have
 * seen the list: this rewrites data they chose by hand, in five tables at
 * once, with no undo beyond re-picking. So it shows every swap first, with
 * the emoji next to the icon replacing it, and every row can be ticked off.
 *
 * Emoji with no honest icon match never appear — the plan leaves them
 * alone, which is why the list is usually shorter than the row count.
 */
export function IconMigrationSection() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const [applying, startApply] = useTransition();

  const kept = rows?.filter((r) => r.keep) ?? [];

  async function scan() {
    setLoading(true);
    setError(null);
    setApplied(null);
    try {
      const result = await proposeIconMigrationAction();
      if (result.ok === false) setError(result.error);
      else {
        setScanned(result.scanned);
        setRows(result.changes.map((c) => ({ ...c, keep: true })));
      }
    } catch (err) {
      // The action resolves its own expected failures, so a rejection here
      // is a transport problem — without this the button stays spinning.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggle(kind: IconMigrationKind, id: string) {
    setRows((prev) =>
      (prev ?? []).map((r) =>
        r.kind === kind && r.id === id ? { ...r, keep: !r.keep } : r
      )
    );
  }

  function apply() {
    setError(null);
    startApply(async () => {
      const result = await applyIconMigrationAction(
        kept.map((r) => ({ kind: r.kind, id: r.id }))
      );
      if (result.ok === false) {
        setError(
          result.applied > 0
            ? t("settings.iconMigration.appliedPartially", {
                count: result.applied,
                error: result.error,
              })
            : result.error
        );
        return;
      }
      setApplied(result.applied);
      setRows(null);
      setScanned(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {rows === null && (
        <button
          type="button"
          onClick={() => void scan()}
          disabled={loading}
          className="px-4 py-2 rounded-[16px] soft-raised-sm soft-pressable text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <JtIcon name="loader-2" size={16} className="animate-spin" />
          ) : (
            <JtIcon name="sparkles" size={16} />
          )}
          {loading
            ? t("settings.iconMigration.scanning")
            : t("settings.iconMigration.scan")}
        </button>
      )}

      {applied !== null && (
        <p className="text-sm text-(--income)">
          {t("settings.iconMigration.done", { count: applied })}
        </p>
      )}

      {rows !== null && scanned !== null && (
        <p className="text-sm text-(--muted)">
          {t("settings.iconMigration.summary", {
            scanned,
            changes: rows.length,
          })}
        </p>
      )}

      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-(--muted)">
          {t("settings.iconMigration.none")}
        </p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <ul className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {rows.map((row) => (
              <li key={`${row.kind}:${row.id}`}>
                <button
                  type="button"
                  onClick={() => toggle(row.kind, row.id)}
                  aria-pressed={row.keep}
                  className={`w-full text-left rounded-[16px] px-3 py-2 flex items-center gap-2.5 transition ${
                    row.keep ? "soft-raised-sm" : "soft-well-sm opacity-60"
                  }`}
                >
                  <span
                    className={`shrink-0 h-5 w-5 rounded-md flex items-center justify-center ${
                      row.keep ? "bg-(--accent) text-(--accent-foreground)" : ""
                    }`}
                    aria-hidden
                  >
                    {row.keep && <JtIcon name="check" size={13} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium truncate">
                      {row.name}
                    </span>
                    <span className="block text-[11px] text-(--muted)">
                      {t(KIND_LABEL_KEY[row.kind])}
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center gap-2">
                    <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
                      {row.from}
                    </span>
                    <JtIcon name="arrow-right" size={13} />
                    <JtIcon name={row.to} size={20} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-(--muted)">
              {t("settings.iconMigration.keptCount", { count: kept.length })}
            </span>
            <button
              type="button"
              onClick={apply}
              disabled={applying || kept.length === 0}
              className="px-4 py-2 rounded-[16px] bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50 transition"
            >
              {applying
                ? t("settings.iconMigration.applying")
                : t("settings.iconMigration.apply", { count: kept.length })}
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-(--expense)">{error}</p>}
    </div>
  );
}
