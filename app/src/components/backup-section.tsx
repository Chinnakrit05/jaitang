"use client";

import { useRef, useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  restoreBackupAction,
} from "@/app/(app)/settings/backup-actions";
import type { RestoreSummary } from "@/lib/backup";

export type AutoBackupDay = {
  /** YYYY-MM-DD — the file's name, and the download path. */
  date: string;
  /** The same day, written for the reader's locale. */
  label: string;
};

export function BackupSection({ autoBackups }: { autoBackups: AutoBackupDay[] }) {
  const t = useTranslations();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RestoreSummary | null>(null);

  function handleFile(file: File) {
    setError(null);
    setSummary(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await restoreBackupAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSummary(result.summary);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Download */}
      <div>
        <a
          href="/api/backup"
          download
          className="inline-flex items-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) px-4 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          <JtIcon name="download" size={20} />
          {t("backup.downloadButton")}
        </a>
        <p className="text-xs text-(--muted) mt-2">{t("backup.downloadHint")}</p>
      </div>

      {/* Nightly — written by /api/cron/backup, newest first */}
      <div className="pt-4 border-t border-(--border) space-y-2">
        <div className="text-sm font-medium">{t("backup.autoTitle")}</div>
        <p className="text-xs text-(--muted)">{t("backup.autoHint")}</p>
        {autoBackups.length === 0 ? (
          <p className="text-xs text-(--muted)">{t("backup.autoNone")}</p>
        ) : (
          <>
            <a
              href={`/api/backup/${autoBackups[0].date}`}
              download
              className="inline-flex items-center gap-2 rounded-[16px] soft-raised hover:bg-(--background) px-4 py-2.5 text-sm font-medium"
            >
              <JtIcon name="download" size={18} />
              {t("backup.autoLatest", { date: autoBackups[0].label })}
            </a>
            {autoBackups.length > 1 && (
              <details>
                <summary className="cursor-pointer select-none text-xs text-(--muted)">
                  {t("backup.autoOlder", { count: autoBackups.length - 1 })}
                </summary>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {autoBackups.slice(1).map((b) => (
                    <li key={b.date}>
                      <a
                        href={`/api/backup/${b.date}`}
                        download
                        className="inline-block rounded-full soft-well-sm px-3 py-1 text-xs tabular-nums hover:text-(--accent)"
                      >
                        {b.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      {/* Upload / Restore */}
      <div className="pt-4 border-t border-(--border)">
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (
              !confirm(t("backup.restoreConfirm"))
            )
              return;
            inputRef.current?.click();
          }}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[16px] soft-raised hover:bg-(--background) px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? (
            <>
              <JtIcon name="loader-2" size={20} className="animate-spin" />
              {t("backup.restoring")}
            </>
          ) : (
            <>
              <JtIcon name="upload" size={20} />
              {t("backup.restoreButton")}
            </>
          )}
        </button>
        <p className="text-xs text-(--muted) mt-2">{t("backup.restoreHint")}</p>
      </div>

      {/* Result */}
      {summary && (
        <div className="rounded-xl border border-(--income)/40 bg-(--income)/5 p-3 flex items-start gap-3">
          <JtIcon name="check-circle-2" size={22} className="text-(--income) shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">{t("backup.restoreDoneTitle")}</div>
            <div className="text-(--muted) text-xs mt-1">
              {t("backup.restoreSummary", {
                ledgers: summary.ledgersCreated,
                transactions: summary.transactionsCreated,
                categories: summary.categoriesCreated,
                budgets: summary.budgetsCreated,
                recurring: summary.recurringCreated,
              })}
              {summary.ledgersSkipped > 0 && (
                <> · {t("backup.skipped", { count: summary.ledgersSkipped })}</>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-(--expense)/40 bg-(--expense)/5 p-3 flex items-start gap-3">
          <JtIcon name="alert-circle" size={22} className="text-(--expense) shrink-0 mt-0.5" />
          <div className="text-sm text-(--expense)">{error}</div>
        </div>
      )}
    </div>
  );
}
