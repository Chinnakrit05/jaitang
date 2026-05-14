"use client";

import { useState, useTransition } from "react";
import { JtIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  createInviteAction,
  deleteInviteAction,
} from "@/app/(app)/ledgers/actions";
import { formatDate } from "@/lib/utils";
import { intlLocale } from "@/lib/locale-format";

type Invite = {
  id: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
};

export function InvitesPanel({
  ledgerId,
  invites,
}: {
  ledgerId: string;
  invites: Invite[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const fmtLocale = intlLocale(locale);
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [maxUses, setMaxUses] = useState(5);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  function copy(code: string) {
    const url = `${baseUrl}/invite/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
    });
  }

  return (
    <div className="space-y-3">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2.5 text-sm font-medium transition"
        >
          <JtIcon name="plus-fab" size={20} />
          {t("invites.createNew")}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.set("ledgerId", ledgerId);
            fd.set("role", role);
            fd.set("maxUses", String(maxUses));
            fd.set("expiresInDays", String(expiresInDays));
            startTransition(async () => {
              const result = await createInviteAction(fd);
              if (result?.ok === false) {
                setError(result.error);
                return;
              }
              setError(null);
              setShowForm(false);
              router.refresh();
            });
          }}
          className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-(--muted)">
                {t("invites.permission")}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                className="w-full px-2.5 py-2 rounded-lg border border-(--border) bg-(--background) text-sm"
              >
                <option value="editor">{t("invites.permissionEditor")}</option>
                <option value="viewer">{t("invites.permissionViewer")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-(--muted)">
                {t("invites.maxUses")}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-(--border) bg-(--background) text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-(--muted)">
                {t("invites.expiresInDays")}
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-lg border border-(--border) bg-(--background) text-sm"
              />
            </div>
          </div>
          {error && <p className="text-xs text-(--expense)">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-[2] px-3 py-2 rounded-lg bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50"
            >
              {pending ? t("common.creating") : t("invites.createButton")}
            </button>
          </div>
        </form>
      )}

      {invites.length === 0 ? (
        <p className="text-sm text-(--muted) px-1">{t("invites.empty")}</p>
      ) : (
        <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
          {invites.map((inv) => {
            const url = `${baseUrl}/invite/${inv.code}`;
            const expired =
              inv.expires_at && new Date(inv.expires_at) < new Date();
            const exhausted = inv.used_count >= inv.max_uses;
            const dead = expired || exhausted;
            return (
              <li
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition"
              >
                <JtIcon name="link-2" size={22} className="text-(--muted) shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold">
                      {inv.code}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-(--background) border border-(--border)">
                      {inv.role === "editor" ? t("ledgers.roleEditor") : t("ledgers.roleViewer")}
                    </span>
                    {dead && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-(--expense)/15 text-(--expense)">
                        {expired ? t("invites.expired") : t("invites.exhausted")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-(--muted) mt-0.5">
                    {t("invites.usedCount", { used: inv.used_count, max: inv.max_uses })}
                    {inv.expires_at && (
                      <span className="ml-2">
                        •{" "}
                        {t("invites.expiresAt", {
                          when: formatDate(inv.expires_at, fmtLocale),
                        })}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-(--muted) truncate mt-0.5">
                    {url}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copy(inv.code)}
                  className="p-2 rounded-lg text-(--muted) hover:bg-(--background) hover:text-(--foreground)"
                  aria-label={t("common.more")}
                >
                  {copiedCode === inv.code ? (
                    <JtIcon name="check" size={20} className="text-(--income)" />
                  ) : (
                    <JtIcon name="copy" size={20} />
                  )}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(t("invites.deleteConfirm"))) return;
                    startTransition(async () => {
                      await deleteInviteAction(inv.id);
                      router.refresh();
                    });
                  }}
                  className="p-2 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
                  aria-label={t("common.delete")}
                >
                  <JtIcon name="trash2" size={20} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
