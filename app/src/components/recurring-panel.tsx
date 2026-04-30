"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Play, Pause, RefreshCw } from "lucide-react";
import type { Category, TxKind } from "@/lib/types";
import type { RecurPeriod, RecurringRule } from "@/lib/recurring";
import {
  createRecurringAction,
  deleteRecurringAction,
  runDueAction,
  toggleRecurringAction,
} from "@/app/(app)/recurring/actions";
import { formatTHB, formatDateTH, cn } from "@/lib/utils";

const PERIOD_LABEL: Record<RecurPeriod, string> = {
  daily: "ทุกวัน",
  weekly: "ทุกสัปดาห์",
  monthly: "ทุกเดือน",
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function RecurringPanel({
  rules,
  categories,
}: {
  rules: RecurringRule[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(rules.length === 0);

  function applyDue() {
    startTransition(async () => {
      const result = await runDueAction();
      router.refresh();
      if (result.created > 0) {
        alert(`สร้างรายการใหม่ ${result.created} รายการ`);
      } else {
        alert("ยังไม่มีรายการประจำที่ถึงกำหนด");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2.5 text-sm font-medium transition"
        >
          <Plus size={16} />
          เพิ่มรายการประจำ
        </button>
        <button
          type="button"
          onClick={applyDue}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={pending ? "animate-spin" : ""} />
          รันรายการที่ครบกำหนด
        </button>
      </div>

      {showForm && (
        <CreateRecurringForm
          categories={categories}
          onDone={() => setShowForm(false)}
        />
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-(--muted) px-1">
          ยังไม่มีรายการประจำ — กดปุ่มด้านบนเพื่อเพิ่มอันแรก
        </p>
      ) : (
        <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} pending={pending} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateRecurringForm({
  categories,
  onDone,
}: {
  categories: Category[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<TxKind>("expense");
  const [period, setPeriod] = useState<RecurPeriod>("monthly");
  const [error, setError] = useState<string | null>(null);
  const visibleCats = categories.filter((c) => c.kind === kind);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("kind", kind);
        fd.set("period", period);
        startTransition(async () => {
          const result = await createRecurringAction(fd);
          if (result?.ok === false) setError(result.error);
          else {
            router.refresh();
            onDone();
          }
        });
      }}
      className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-4"
    >
      <div className="grid grid-cols-2 gap-2 p-1 bg-(--background) rounded-xl">
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={cn(
            "py-2 rounded-lg text-sm font-medium transition",
            kind === "expense"
              ? "bg-(--expense) text-white"
              : "text-(--muted)"
          )}
        >
          📤 รายจ่าย
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={cn(
            "py-2 rounded-lg text-sm font-medium transition",
            kind === "income" ? "bg-(--income) text-white" : "text-(--muted)"
          )}
        >
          📥 รายรับ
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted)">
            จำนวน (บาท)
          </label>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background) tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-(--muted)">
            ความถี่
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as RecurPeriod)}
            className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
          >
            <option value="monthly">ทุกเดือน</option>
            <option value="weekly">ทุกสัปดาห์</option>
            <option value="daily">ทุกวัน</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 text-(--muted)">
          หมวดหมู่
        </label>
        <select
          name="categoryId"
          required
          className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
        >
          <option value="">เลือกหมวด</option>
          {visibleCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 text-(--muted)">
          รันครั้งแรกเมื่อ
        </label>
        <input
          name="startDate"
          type="datetime-local"
          required
          defaultValue={toLocalInput(new Date(Date.now() + 60_000))}
          className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 text-(--muted)">
          โน้ต (ไม่บังคับ)
        </label>
        <input
          name="note"
          type="text"
          maxLength={500}
          placeholder="ค่าเช่าบ้าน, เน็ต, ค่าสมาชิก..."
          className="w-full px-3 py-2 rounded-lg border border-(--border) bg-(--background)"
        />
      </div>

      {error && <p className="text-sm text-(--expense)">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--card) text-sm"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-[2] px-3 py-2 rounded-lg bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "กำลังสร้าง…" : "สร้างรายการประจำ"}
        </button>
      </div>
    </form>
  );
}

function RuleRow({ rule, pending }: { rule: RecurringRule; pending: boolean }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  return (
    <li
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition",
        !rule.active && "opacity-60"
      )}
    >
      <span className="text-2xl">{rule.category?.icon ?? "✨"}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {rule.category?.name ?? "ไม่ระบุหมวด"}
        </div>
        <div className="text-xs text-(--muted) flex items-center gap-2 flex-wrap">
          <span>{PERIOD_LABEL[rule.period]}</span>
          <span>•</span>
          <span>ครั้งถัดไป: {formatDateTH(rule.next_run_at)}</span>
          {rule.note && (
            <>
              <span>•</span>
              <span className="truncate">{rule.note}</span>
            </>
          )}
        </div>
      </div>
      <div
        className={`tabular-nums font-semibold ${
          rule.kind === "income" ? "text-(--income)" : "text-(--expense)"
        }`}
      >
        {rule.kind === "income" ? "+" : "−"}
        {formatTHB(rule.amount)}
      </div>
      <button
        type="button"
        disabled={pending || busy}
        onClick={() =>
          startTransition(async () => {
            await toggleRecurringAction(rule.id, !rule.active);
            router.refresh();
          })
        }
        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
        aria-label={rule.active ? "หยุดชั่วคราว" : "เปิดใช้งาน"}
      >
        {rule.active ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        type="button"
        disabled={pending || busy}
        onClick={() => {
          if (!confirm("ลบรายการประจำนี้?")) return;
          startTransition(async () => {
            await deleteRecurringAction(rule.id);
            router.refresh();
          });
        }}
        className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
        aria-label="ลบ"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
