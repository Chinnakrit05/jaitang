"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import type { Category, TxKind } from "@/lib/types";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/(app)/categories/actions";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#f97316", "#3b82f6", "#a855f7", "#ec4899",
  "#10b981", "#64748b", "#0ea5e9", "#94a3b8",
  "#22c55e", "#84cc16", "#14b8a6", "#06b6d4",
];

const PRESET_ICONS = [
  "🍜", "☕", "🚗", "🛒", "🎮", "💊", "🏠", "📚",
  "✈️", "👕", "🐶", "🎁", "💰", "📈", "🏷️", "✨",
];

export function CategoryManager({ initial }: { initial: Category[] }) {
  const [tab, setTab] = useState<TxKind>("expense");

  const filtered = initial.filter((c) => c.kind === tab);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 p-1 bg-(--card) rounded-xl border border-(--border)">
        <button
          type="button"
          onClick={() => setTab("expense")}
          className={cn(
            "py-2 rounded-lg text-sm font-medium transition",
            tab === "expense"
              ? "bg-(--expense) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          📤 รายจ่าย ({initial.filter((c) => c.kind === "expense").length})
        </button>
        <button
          type="button"
          onClick={() => setTab("income")}
          className={cn(
            "py-2 rounded-lg text-sm font-medium transition",
            tab === "income"
              ? "bg-(--income) text-white"
              : "text-(--muted) hover:text-(--foreground)"
          )}
        >
          📥 รายรับ ({initial.filter((c) => c.kind === "income").length})
        </button>
      </div>

      <CreateCategoryForm kind={tab} key={tab} />

      <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
        {filtered.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-(--muted) text-sm">
            ยังไม่มีหมวด — เพิ่มด้านบนได้เลย
          </li>
        )}
      </ul>
    </div>
  );
}

function CreateCategoryForm({ kind }: { kind: TxKind }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("✨");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const fd = new FormData();
        fd.set("kind", kind);
        fd.set("name", name);
        fd.set("icon", icon);
        fd.set("color", color);
        startTransition(async () => {
          const result = await createCategoryAction(fd);
          if (result?.ok === false) {
            setError(result.error);
            return;
          }
          setName("");
          setError(null);
          router.refresh();
        });
      }}
      className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="เลือกไอคอน"
          className="text-2xl px-3 py-2 rounded-lg border border-(--border) hover:bg-(--background)"
          onClick={() => {
            const idx = PRESET_ICONS.indexOf(icon);
            setIcon(PRESET_ICONS[(idx + 1) % PRESET_ICONS.length]);
          }}
        >
          {icon}
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "expense" ? "เช่น ค่ากาแฟ" : "เช่น ค่าคอมมิชชั่น"}
          maxLength={50}
          className="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--background) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-(--accent) text-(--accent-foreground) font-medium text-sm disabled:opacity-50"
        >
          <Plus size={16} /> เพิ่ม
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition",
              color === c ? "border-(--foreground) scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      {error && <p className="text-xs text-(--expense)">{error}</p>}
    </form>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon ?? "✨");

  function save() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("icon", icon);
    if (category.color) fd.set("color", category.color);
    startTransition(async () => {
      const result = await updateCategoryAction(category.id, fd);
      if (result?.ok !== false) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (
      !confirm(
        "ลบหมวดนี้? รายการที่ใช้หมวดนี้จะกลายเป็น 'ไม่ระบุหมวด' (ไม่ถูกลบ)"
      )
    )
      return;
    startTransition(async () => {
      await deleteCategoryAction(category.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition">
      {editing ? (
        <>
          <button
            type="button"
            onClick={() => {
              const idx = PRESET_ICONS.indexOf(icon);
              setIcon(PRESET_ICONS[(idx + 1) % PRESET_ICONS.length]);
            }}
            className="text-2xl px-2 py-1 rounded-lg border border-(--border)"
          >
            {icon}
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="flex-1 px-2 py-1 rounded-lg border border-(--border) bg-(--background)"
            autoFocus
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="p-1.5 rounded-lg text-(--income) hover:bg-(--income)/10"
            aria-label="บันทึก"
          >
            <Check size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(category.name);
              setIcon(category.icon ?? "✨");
            }}
            className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card)"
            aria-label="ยกเลิก"
          >
            <X size={18} />
          </button>
        </>
      ) : (
        <>
          <span className="text-2xl">{category.icon ?? "✨"}</span>
          <span className="flex-1 font-medium">{category.name}</span>
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: category.color ?? "#94a3b8" }}
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
            aria-label="แก้ไข"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
            aria-label="ลบ"
          >
            <Trash2 size={16} />
          </button>
        </>
      )}
    </li>
  );
}
