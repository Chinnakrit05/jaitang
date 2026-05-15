"use client";

import { useState, useTransition } from "react";
import { JtIcon, EmojiOrIcon, type IconName } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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

// 14 of the original 16 emoji map to Sticker Pop JtIcons; the two outliers
// (shirt 👕, dog 🐶) don't have an equivalent yet so we drop them from the
// picker. Old categories that picked those values still render fine via
// EmojiOrIcon at display time.
const PRESET_ICONS: IconName[] = [
  "ramen",
  "coffee",
  "car",
  "shopping-cart",
  "game-controller",
  "pill",
  "house",
  "books",
  "airplane",
  "gift",
  "money-bag",
  "trending-up",
  "tag",
  "sparkle",
];
const DEFAULT_CATEGORY_ICON: IconName = "sparkle";

export function CategoryManager({ initial }: { initial: Category[] }) {
  const t = useTranslations();
  const [tab, setTab] = useState<TxKind>("expense");

  const inTab = initial.filter((c) => c.kind === tab);
  // Parents go first, then each parent's subs collapsed underneath. Subs
  // pointing to a missing parent (defensive) get listed at root level.
  const parentsInTab = inTab.filter((c) => c.parent_id === null);
  const subsByParent = new Map<string, Category[]>();
  for (const c of inTab) {
    if (c.parent_id) {
      if (!subsByParent.has(c.parent_id))
        subsByParent.set(c.parent_id, []);
      subsByParent.get(c.parent_id)!.push(c);
    }
  }
  const expenseCount = initial.filter((c) => c.kind === "expense").length;
  const incomeCount = initial.filter((c) => c.kind === "income").length;

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
          {t("categories.expenseTab", { count: expenseCount })}
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
          {t("categories.incomeTab", { count: incomeCount })}
        </button>
      </div>

      <CreateCategoryForm kind={tab} parents={parentsInTab} key={tab} />

      <ul className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
        {parentsInTab.map((parent) => {
          const subs = subsByParent.get(parent.id) ?? [];
          return (
            <li key={parent.id}>
              <CategoryRow category={parent} parents={parentsInTab} />
              {subs.length > 0 && (
                <ul className="bg-(--background)/40 border-t border-(--border)">
                  {subs.map((sub) => (
                    <CategoryRow
                      key={sub.id}
                      category={sub}
                      parents={parentsInTab}
                      indent
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {parentsInTab.length === 0 && (
          <li className="px-4 py-8 text-center text-(--muted) text-sm">
            {t("categories.empty")}
          </li>
        )}
      </ul>
    </div>
  );
}

function CreateCategoryForm({
  kind,
  parents,
}: {
  kind: TxKind;
  parents: Category[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [parentId, setParentId] = useState<string>("");
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
        if (parentId) fd.set("parentId", parentId);
        startTransition(async () => {
          const result = await createCategoryAction(fd);
          if (result?.ok === false) {
            setError(result.error);
            return;
          }
          setName("");
          setParentId("");
          setError(null);
          router.refresh();
        });
      }}
      className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t("ledgers.icon")}
          className="px-3 py-2 rounded-lg border border-(--border) hover:bg-(--background) flex items-center justify-center"
          onClick={() => {
            const idx = PRESET_ICONS.indexOf(icon as IconName);
            setIcon(PRESET_ICONS[(idx + 1) % PRESET_ICONS.length]);
          }}
        >
          <EmojiOrIcon value={icon} size={28} />
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            kind === "expense"
              ? t("categories.expensePlaceholder")
              : t("categories.incomePlaceholder")
          }
          maxLength={50}
          className="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--background) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-(--accent) text-(--accent-foreground) font-medium text-sm disabled:opacity-50"
        >
          <JtIcon name="plus-fab" size={20} /> {t("categories.addButton")}
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
      {parents.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <label className="text-(--muted)">{t("categories.parentLabel")}</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border border-(--border) bg-(--background) text-sm"
          >
            <option value="">{t("categories.parentNone")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-xs text-(--expense)">{error}</p>}
    </form>
  );
}

function CategoryRow({
  category,
  parents,
  indent,
}: {
  category: Category;
  parents: Category[];
  indent?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon ?? DEFAULT_CATEGORY_ICON);
  const [parentId, setParentId] = useState<string>(category.parent_id ?? "");
  // Don't let a category that already has children become a sub itself —
  // backend will reject it but disable the dropdown options to make that
  // clear in the UI. This is a soft hint; the server is the authority.
  const eligibleParents = parents.filter((p) => p.id !== category.id);

  function save() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("icon", icon);
    if (category.color) fd.set("color", category.color);
    fd.set("parentId", parentId);
    startTransition(async () => {
      const result = await updateCategoryAction(category.id, fd);
      if (result?.ok !== false) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!confirm(t("categories.deleteConfirm"))) return;
    startTransition(async () => {
      await deleteCategoryAction(category.id);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-(--background) transition",
        indent && "pl-10",
      )}
    >
      {editing ? (
        <>
          <button
            type="button"
            onClick={() => {
              const idx = PRESET_ICONS.indexOf(icon as IconName);
              setIcon(PRESET_ICONS[(idx + 1) % PRESET_ICONS.length]);
            }}
            className="px-2 py-1 rounded-lg border border-(--border) flex items-center justify-center"
          >
            <EmojiOrIcon value={icon} size={26} />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="flex-1 px-2 py-1 rounded-lg border border-(--border) bg-(--background)"
            autoFocus
          />
          {eligibleParents.length > 0 && (
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="px-2 py-1 rounded-lg border border-(--border) bg-(--background) text-xs max-w-[120px]"
              aria-label={t("categories.parentLabel")}
            >
              <option value="">{t("categories.parentNone")}</option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="p-1.5 rounded-lg text-(--income) hover:bg-(--income)/10"
            aria-label={t("common.save")}
          >
            <JtIcon name="check" size={22} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(category.name);
              setIcon(category.icon ?? DEFAULT_CATEGORY_ICON);
              setParentId(category.parent_id ?? "");
            }}
            className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card)"
            aria-label={t("common.cancel")}
          >
            <JtIcon name="x" size={22} />
          </button>
        </>
      ) : (
        <>
          <EmojiOrIcon value={category.icon} fallback={DEFAULT_CATEGORY_ICON} size={28} />
          <span className="flex-1 font-medium">{category.name}</span>
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: category.color ?? "#94a3b8" }}
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
            aria-label={t("common.edit")}
          >
            <JtIcon name="pencil" size={20} />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="p-1.5 rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
            aria-label={t("common.delete")}
          >
            <JtIcon name="trash2" size={20} />
          </button>
        </>
      )}
    </div>
  );
}
