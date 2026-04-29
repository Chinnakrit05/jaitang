"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Category, TxKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  categories: Category[];
  initial?: {
    id?: string;
    kind: TxKind;
    amount: number;
    categoryId: string | null;
    note: string | null;
    occurredAt: string;
  };
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  submitLabel?: string;
};

function toLocalInput(iso: string) {
  // "2026-04-29T22:30:00.000Z" → "2026-04-29T22:30" in local TZ
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function TransactionForm({ categories, initial, action, submitLabel = "บันทึก" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<TxKind>(initial?.kind ?? "expense");
  const [error, setError] = useState<string | null>(null);

  const visibleCats = categories.filter((c) => c.kind === kind);

  const defaultDate = initial?.occurredAt
    ? toLocalInput(initial.occurredAt)
    : toLocalInput(new Date().toISOString());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await action(fd);
          if (result && "ok" in result && result.ok === false) {
            setError(result.error);
          }
        });
      }}
      className="space-y-5"
    >
      {/* Kind toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-(--card) rounded-xl border border-(--border)">
        <input type="hidden" name="kind" value={kind} />
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={cn(
            "py-2.5 rounded-lg text-sm font-medium transition",
            kind === "expense"
              ? "bg-(--expense) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          📤 รายจ่าย
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={cn(
            "py-2.5 rounded-lg text-sm font-medium transition",
            kind === "income"
              ? "bg-(--income) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          📥 รายรับ
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium mb-1.5">จำนวน (บาท)</label>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          required
          defaultValue={initial?.amount}
          placeholder="0.00"
          className="w-full px-4 py-3 rounded-xl border border-(--border) bg-(--card) text-2xl font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-(--accent)"
          autoFocus={!initial}
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-1.5">หมวดหมู่</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleCats.map((c) => (
            <CategoryRadio
              key={c.id}
              category={c}
              defaultChecked={initial?.categoryId === c.id}
            />
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium mb-1.5">วันที่/เวลา</label>
        <input
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={defaultDate}
          className="w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--card) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium mb-1.5">โน้ต (ไม่บังคับ)</label>
        <input
          name="note"
          type="text"
          maxLength={500}
          defaultValue={initial?.note ?? ""}
          placeholder="กาแฟตอนเช้า, ค่าน้ำมัน, ..."
          className="w-full px-3 py-2.5 rounded-xl border border-(--border) bg-(--card) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) transition font-medium"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-[2] px-4 py-3 rounded-xl bg-(--accent) text-(--accent-foreground) font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function CategoryRadio({
  category,
  defaultChecked,
}: {
  category: Category;
  defaultChecked: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="categoryId"
        value={category.id}
        defaultChecked={defaultChecked}
        className="peer sr-only"
        required
      />
      <div
        className="flex flex-col items-center gap-1 px-3 py-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) transition peer-checked:border-(--accent) peer-checked:bg-(--accent)/5 peer-checked:ring-2 peer-checked:ring-(--accent)/30"
      >
        <span className="text-2xl">{category.icon ?? "✨"}</span>
        <span className="text-xs font-medium">{category.name}</span>
      </div>
    </label>
  );
}
