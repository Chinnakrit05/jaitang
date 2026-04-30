"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { Balance } from "@/lib/splits";
import { settleBetweenAction } from "@/app/(app)/balances/actions";
import { formatTHB } from "@/lib/utils";

export function BalancesPanel({
  balances,
  currentUserId,
}: {
  balances: Balance[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (balances.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/50 p-10 text-center">
        <span className="text-4xl mb-3 block">✨</span>
        <p className="font-medium mb-1">ทุกคนเคลียร์ยอดกันหมดแล้ว</p>
        <p className="text-sm text-(--muted)">
          ยังไม่มีบิลที่หารกันค้างไว้ในสมุดนี้
        </p>
      </div>
    );
  }

  // Group by current user vs others to surface "what concerns me" first
  const youOwe = balances.filter((b) => b.debtorId === currentUserId);
  const owedToYou = balances.filter((b) => b.payerId === currentUserId);
  const others = balances.filter(
    (b) => b.debtorId !== currentUserId && b.payerId !== currentUserId
  );

  return (
    <div className="space-y-5">
      {youOwe.length > 0 && (
        <Section
          title="คุณติดเงินคนอื่น"
          tone="expense"
          balances={youOwe}
          currentUserId={currentUserId}
          pending={pending}
          onSettle={(b) => {
            if (!confirm(`ยืนยันว่าจ่ายคืน ${b.payerName} แล้ว?`)) return;
            startTransition(async () => {
              await settleBetweenAction({ debtorId: b.debtorId, payerId: b.payerId });
              router.refresh();
            });
          }}
        />
      )}
      {owedToYou.length > 0 && (
        <Section
          title="คนอื่นติดเงินคุณ"
          tone="income"
          balances={owedToYou}
          currentUserId={currentUserId}
          pending={pending}
          onSettle={(b) => {
            if (!confirm(`${b.debtorName} จ่ายคืนแล้ว ปิดบิล?`)) return;
            startTransition(async () => {
              await settleBetweenAction({ debtorId: b.debtorId, payerId: b.payerId });
              router.refresh();
            });
          }}
        />
      )}
      {others.length > 0 && (
        <Section
          title="ระหว่างสมาชิกคนอื่น"
          tone="muted"
          balances={others}
          currentUserId={currentUserId}
          pending={pending}
          onSettle={(b) => {
            if (!confirm(`ปิดบิล ${b.debtorName} → ${b.payerName}?`)) return;
            startTransition(async () => {
              await settleBetweenAction({ debtorId: b.debtorId, payerId: b.payerId });
              router.refresh();
            });
          }}
        />
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  balances,
  currentUserId,
  pending,
  onSettle,
}: {
  title: string;
  tone: "income" | "expense" | "muted";
  balances: Balance[];
  currentUserId: string;
  pending: boolean;
  onSettle: (b: Balance) => void;
}) {
  const accentClass =
    tone === "income"
      ? "text-(--income)"
      : tone === "expense"
      ? "text-(--expense)"
      : "text-(--muted)";

  return (
    <section>
      <h2 className={`text-sm font-semibold mb-2 ${accentClass}`}>{title}</h2>
      <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
        {balances.map((b) => (
          <li
            key={`${b.debtorId}-${b.payerId}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition"
          >
            <Avatar name={b.debtorName} image={b.debtorImage} />
            <span className="text-sm">
              {b.debtorId === currentUserId ? "คุณ" : b.debtorName ?? "?"}
            </span>
            <ArrowRight size={14} className="text-(--muted) shrink-0" />
            <Avatar name={b.payerName} image={b.payerImage} />
            <span className="text-sm">
              {b.payerId === currentUserId ? "คุณ" : b.payerName ?? "?"}
            </span>
            <div className={`ml-auto tabular-nums font-semibold ${accentClass}`}>
              {formatTHB(b.amount)}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => onSettle(b)}
              className="inline-flex items-center gap-1 text-xs text-(--accent) hover:underline disabled:opacity-50 shrink-0"
              aria-label="ปิดบิล"
            >
              <CheckCircle2 size={14} />
              ปิดบิล
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Avatar({
  name,
  image,
}: {
  name: string | null;
  image: string | null;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={image}
        alt={name ?? "?"}
        className="h-7 w-7 rounded-full border border-(--border) shrink-0"
      />
    );
  }
  return (
    <span className="h-7 w-7 rounded-full bg-(--background) border border-(--border) text-xs font-semibold flex items-center justify-center shrink-0">
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
