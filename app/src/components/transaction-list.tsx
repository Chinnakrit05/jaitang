"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { TransactionWithCategory } from "@/lib/types";
import { formatDateTH, formatTHB } from "@/lib/utils";
import { deleteTransactionAction } from "@/app/(app)/transactions/actions";
import { useRouter } from "next/navigation";

export function TransactionList({ items }: { items: TransactionWithCategory[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/50 p-10 text-center">
        <span className="text-4xl mb-3 block">📭</span>
        <p className="font-medium mb-1">ยังไม่มีรายการในช่วงนี้</p>
        <p className="text-sm text-(--muted) mb-4">
          เพิ่มรายการแรกเพื่อเริ่มจดบันทึก
        </p>
        <Link
          href="/transactions/new"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition"
        >
          + เพิ่มรายการ
        </Link>
      </div>
    );
  }

  // Group by day
  const groups = new Map<string, TransactionWithCategory[]>();
  for (const tx of items) {
    const day = tx.occurred_at.slice(0, 10);
    const arr = groups.get(day) ?? [];
    arr.push(tx);
    groups.set(day, arr);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([day, txs]) => {
        const dayIncome = txs
          .filter((t) => t.kind === "income")
          .reduce((s, t) => s + t.amount, 0);
        const dayExpense = txs
          .filter((t) => t.kind === "expense")
          .reduce((s, t) => s + t.amount, 0);

        return (
          <section key={day}>
            <header className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-semibold text-(--muted)">
                {new Intl.DateTimeFormat("th-TH", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  weekday: "short",
                }).format(new Date(day))}
              </h3>
              <span className="text-xs tabular-nums text-(--muted)">
                {dayIncome > 0 && (
                  <span className="text-(--income) mr-2">
                    +{formatTHB(dayIncome)}
                  </span>
                )}
                {dayExpense > 0 && (
                  <span className="text-(--expense)">
                    −{formatTHB(dayExpense)}
                  </span>
                )}
              </span>
            </header>
            <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
              {txs.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition group"
                >
                  <span className="text-2xl">{tx.category?.icon ?? "✨"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {tx.category?.name ?? "ไม่ระบุหมวด"}
                    </div>
                    {tx.note && (
                      <div className="text-sm text-(--muted) truncate">
                        {tx.note}
                      </div>
                    )}
                    <div className="text-xs text-(--muted)">
                      {formatDateTH(tx.occurred_at)}
                    </div>
                  </div>
                  <div
                    className={`tabular-nums font-semibold ${
                      tx.kind === "income" ? "text-(--income)" : "text-(--expense)"
                    }`}
                  >
                    {tx.kind === "income" ? "+" : "−"}
                    {formatTHB(tx.amount)}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Link
                      href={`/transactions/${tx.id}/edit`}
                      className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
                      aria-label="แก้ไข"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("ลบรายการนี้?")) return;
                        startTransition(async () => {
                          await deleteTransactionAction(tx.id);
                          router.refresh();
                        });
                      }}
                      className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
                      aria-label="ลบ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
