"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Member } from "@/lib/members";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/(app)/ledgers/actions";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของ",
  editor: "ร่วมจด",
  viewer: "ดูอย่างเดียว",
};

export function MembersPanel({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
      {members.map((m) => {
        const isOwner = m.role === "owner";
        const isYou = m.user_id === currentUserId;
        return (
          <li
            key={m.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition"
          >
            {m.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.user.image}
                alt={m.user.name ?? m.user.email}
                className="h-10 w-10 rounded-full border border-(--border)"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-(--background) border border-(--border) flex items-center justify-center text-sm font-semibold">
                {(m.user?.name ?? m.user?.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate flex items-center gap-2">
                {m.user?.name ?? m.user?.email ?? "(ไม่ทราบชื่อ)"}
                {isYou && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-(--accent)/15 text-(--accent)">
                    คุณ
                  </span>
                )}
              </div>
              {m.user?.email && (
                <div className="text-xs text-(--muted) truncate">{m.user.email}</div>
              )}
            </div>

            {isOwner ? (
              <span className="text-sm font-medium text-(--accent)">
                {ROLE_LABEL.owner}
              </span>
            ) : (
              <>
                <select
                  defaultValue={m.role}
                  disabled={pending}
                  onChange={(e) => {
                    const role = e.target.value;
                    startTransition(async () => {
                      await updateMemberRoleAction(m.id, role);
                      router.refresh();
                    });
                  }}
                  className="px-2 py-1 rounded-lg border border-(--border) bg-(--card) text-sm"
                >
                  <option value="editor">{ROLE_LABEL.editor}</option>
                  <option value="viewer">{ROLE_LABEL.viewer}</option>
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`เอา ${m.user?.name ?? "สมาชิก"} ออกจากสมุด?`)) return;
                    startTransition(async () => {
                      await removeMemberAction(m.id);
                      router.refresh();
                    });
                  }}
                  className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
                  aria-label="ลบสมาชิก"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
