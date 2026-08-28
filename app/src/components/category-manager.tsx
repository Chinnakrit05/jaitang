"use client";

import { useEffect, useState, useTransition } from "react";
import {
  JtIcon,
  EmojiOrIcon,
  EMOJI_GROUPS,
  ICON_PICKER_GROUPS,
  PICKER_ICON_NAMES,
  type IconName,
} from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Category, TxKind } from "@/lib/types";
import {
  copyCategoriesFromLedgerAction,
  createCategoryAction,
  deleteCategoryAction,
  undoDeleteCategoryAction,
  updateCategoryAction,
} from "@/app/(app)/categories/actions";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#f97316", "#3b82f6", "#a855f7", "#ec4899",
  "#10b981", "#64748b", "#0ea5e9", "#94a3b8",
  "#22c55e", "#84cc16", "#14b8a6", "#06b6d4",
];

// A vector name rather than the old "✨" char, so a category created
// without touching the picker still follows the active icon style.
const DEFAULT_CATEGORY_ICON = "sparkle";

type OtherLedger = {
  id: string;
  name: string;
  icon: string | null;
  isPersonal: boolean;
};

export function CategoryManager({
  initial,
  otherLedgers = [],
}: {
  initial: Category[];
  /** Ledgers the user has read on (minus the active one). Drives the
   *  copy-from-another-ledger picker. */
  otherLedgers?: OtherLedger[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [tab, setTab] = useState<TxKind>("expense");
  const [showCopyPicker, setShowCopyPicker] = useState(false);

  // Post-delete undo affordance, mirroring /recurring. Deletes are
  // soft (tombstone) on the server, so "เลิกทำ" just clears the stamp.
  // Cleared on undo, timeout, or the next delete overwriting it.
  const [deletedCategory, setDeletedCategory] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [undoing, startUndo] = useTransition();
  useEffect(() => {
    if (!deletedCategory) return;
    const timer = window.setTimeout(() => setDeletedCategory(null), 8000);
    return () => window.clearTimeout(timer);
  }, [deletedCategory]);

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

      {/* Copy-from-another-ledger affordance. Only shows when the
          user actually has another ledger to copy from. */}
      {otherLedgers.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCopyPicker(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full soft-raised-sm hover:bg-(--background) transition"
        >
          <JtIcon name="copy" size={14} />
          {t("categories.copyFromButton")}
        </button>
      )}

      <CreateCategoryForm kind={tab} parents={parentsInTab} key={tab} />

      {showCopyPicker && (
        <CopyFromLedgerSheet
          ledgers={otherLedgers}
          onClose={() => setShowCopyPicker(false)}
        />
      )}

      <ul className="rounded-[22px] soft-raised divide-y divide-(--border) overflow-hidden">
        {parentsInTab.map((parent) => {
          const subs = subsByParent.get(parent.id) ?? [];
          return (
            <li key={parent.id}>
              <CategoryRow
                category={parent}
                parents={parentsInTab}
                onDeleted={(c) =>
                  setDeletedCategory({ id: c.id, label: c.name })
                }
              />
              {subs.length > 0 && (
                <ul className="bg-(--background)/40 border-t border-(--border)">
                  {subs.map((sub) => (
                    <CategoryRow
                      key={sub.id}
                      category={sub}
                      parents={parentsInTab}
                      onDeleted={(c) =>
                        setDeletedCategory({ id: c.id, label: c.name })
                      }
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

      {/* Undo toast — sits above the bottom nav; one delete at a time. */}
      {deletedCategory && (
        <div className="fixed bottom-24 inset-x-4 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] flex items-center gap-3 px-4 py-2.5 rounded-full soft-raised-sm shadow-lg">
          <span className="min-w-0 text-sm truncate">
            {t("categories.deletedToast", { name: deletedCategory.label })}
          </span>
          <button
            type="button"
            disabled={undoing}
            onClick={() => {
              const target = deletedCategory;
              setDeletedCategory(null);
              startUndo(async () => {
                await undoDeleteCategoryAction(target.id);
                router.refresh();
              });
            }}
            className="inline-flex items-center gap-1 text-sm font-semibold text-(--accent) hover:underline disabled:opacity-50 shrink-0"
          >
            <JtIcon name="rotate-ccw" size={14} />
            {t("common.undo")}
          </button>
        </div>
      )}
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
  // The picker is 250px of tiles. Left open it pushed the category list
  // itself off a phone screen, so it opens from the icon tile instead.
  const [pickerOpen, setPickerOpen] = useState(false);

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
      className="rounded-[22px] soft-raised p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-label={t("categories.iconTab")}
          className={cn(
            "shrink-0 h-11 w-11 rounded-[14px] border bg-(--background) flex items-center justify-center transition",
            pickerOpen
              ? "border-(--accent) ring-2 ring-(--accent)/40"
              : "border-(--border)"
          )}
        >
          <EmojiOrIcon value={icon} size={26} />
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
          // min-w-0 is what stops this pushing the add button off the
          // screen: without it the input refuses to shrink past its
          // placeholder and the row overflows the card.
          className="min-w-0 flex-1 h-11 px-3 rounded-[14px] border border-(--border) bg-(--background) focus:outline-none focus:ring-2 focus:ring-(--accent)"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          // The label is hidden on a phone, so the button needs a name.
          aria-label={t("categories.addButton")}
          className="shrink-0 h-11 inline-flex items-center gap-1 px-3 sm:px-4 rounded-[14px] bg-(--accent) text-(--accent-foreground) font-medium text-sm disabled:opacity-50"
        >
          <JtIcon name="plus-fab" size={20} />
          {/* Label only where the row has room for it. */}
          <span className="hidden sm:inline">{t("categories.addButton")}</span>
        </button>
      </div>

      {pickerOpen && <IconPickerGrid value={icon} onChange={setIcon} />}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            className={cn(
              "h-7 w-7 shrink-0 rounded-full border-2 transition",
              color === c ? "border-(--foreground) scale-110" : "border-transparent"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      {parents.length > 0 && (
        <label className="flex items-center gap-2 text-xs">
          {/* shrink-0 + nowrap: the select was squeezing this label into
              three stacked lines on a phone. */}
          <span className="shrink-0 whitespace-nowrap text-(--muted)">
            {t("categories.parentLabel")}
          </span>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="min-w-0 flex-1 h-9 px-2 rounded-[12px] border border-(--border) bg-(--background) text-sm"
          >
            <option value="">{t("categories.parentNone")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="text-xs text-(--expense)">{error}</p>}
    </form>
  );
}

function CategoryRow({
  category,
  parents,
  indent,
  onDeleted,
}: {
  category: Category;
  parents: Category[];
  indent?: boolean;
  /** Raised after a successful delete so the manager can offer undo. */
  onDeleted?: (category: Category) => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon ?? DEFAULT_CATEGORY_ICON);
  const [parentId, setParentId] = useState<string>(category.parent_id ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
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
      onDeleted?.(category);
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-(--background) transition",
        // Sub-rows sit in from the left, but only while they are a row:
        // an editing sub needs the full width for its form.
        indent && !editing && "pl-9 sm:pl-12",
        indent && editing && "pl-4 sm:pl-6",
      )}
    >
      {editing ? (
        // min-w-0: without it flex-1 sizes to the picker's natural width
        // and the whole edit form runs past the right edge of the card.
        <div className="min-w-0 flex-1 flex flex-col gap-2">
          {/* Name + live icon preview. Action buttons live on their
              own row below (full-width text labels) — the previous
              icon-only check/x inside this header row got lost next
              to the parent dropdown on narrow mobile widths. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              aria-label={t("categories.iconTab")}
              className={cn(
                "shrink-0 h-10 w-10 rounded-[12px] border bg-(--background) flex items-center justify-center transition",
                pickerOpen
                  ? "border-(--accent) ring-2 ring-(--accent)/40"
                  : "border-(--border)"
              )}
            >
              <EmojiOrIcon value={icon} size={24} />
            </button>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="min-w-0 flex-1 h-10 px-2.5 rounded-[12px] border border-(--border) bg-(--background)"
              autoFocus
            />
          </div>
          {eligibleParents.length > 0 && (
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full min-w-0 h-10 px-2.5 rounded-[12px] border border-(--border) bg-(--background) text-sm"
              aria-label={t("categories.parentLabel")}
            >
              <option value="">{t("categories.parentNone")}</option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {t("categories.parentLabel")}: {p.name}
                </option>
              ))}
            </select>
          )}
          {/* Action row lives ABOVE the icon picker so it stays
              visible without scrolling past the tiles. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(category.name);
                setIcon(category.icon ?? DEFAULT_CATEGORY_ICON);
                setParentId(category.parent_id ?? "");
              }}
              className="flex-1 px-3 py-2 rounded-[12px] soft-raised-sm hover:bg-(--background) text-sm font-medium"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending || !name.trim()}
              className="flex-[2] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-(--accent) text-(--accent-foreground) text-sm font-semibold disabled:opacity-50"
            >
              <JtIcon name="check" size={18} />
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
          {pickerOpen && <IconPickerGrid value={icon} onChange={setIcon} />}
        </div>
      ) : (
        <>
          <span className="shrink-0">
            <EmojiOrIcon
              value={category.icon}
              fallback={DEFAULT_CATEGORY_ICON}
              size={indent ? 24 : 28}
            />
          </span>
          {/* min-w-0 + truncate, so a long name ends in an ellipsis
              instead of wrapping the row to three lines. */}
          <span className="min-w-0 flex-1 font-medium truncate">
            {category.name}
          </span>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: category.color ?? "#94a3b8" }}
          />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-(--muted) hover:bg-(--card) hover:text-(--foreground)"
            aria-label={t("common.edit")}
          >
            <JtIcon name="pencil" size={19} />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="shrink-0 h-9 w-9 grid place-items-center rounded-lg text-(--muted) hover:bg-(--expense)/10 hover:text-(--expense)"
            aria-label={t("common.delete")}
          >
            <JtIcon name="trash2" size={19} />
          </button>
        </>
      )}
    </div>
  );
}


/**
 * Inline picker for the category create + edit forms. Two tabs:
 *   - ไอคอน  → 250+ JtIcons, grouped (picker-groups.ts)
 *   - อิโมจิ  → 550+ emoji, same groups
 *
 * The icon tab was hidden for a while because the only styles then were
 * the hand-drawn ones, which read as too illustrative next to the rest of
 * the UI. Lucide and Tabler changed that, and only an icon name can follow
 * the style the user picked — an emoji is a font glyph and always looks
 * the same. So icons lead, and emoji stay for everything no icon set
 * draws (specific dishes, animals, faces).
 *
 * Both tabs put the group strip on top so the user jumps to the right page
 * instead of scrolling a 500-tile wall, and both cap the grid height so a
 * long group can't push the Save button off-screen.
 *
 * The stored `icon` column takes either kind — display goes through
 * <EmojiOrIcon>, which branches on whether the value is a known name.
 */
function IconPickerGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const t = useTranslations();
  // Open on whichever tab the current value came from, so editing a
  // category lands next to what it already has.
  const [tab, setTab] = useState<"icon" | "emoji">(
    PICKER_ICON_NAMES.has(value) ? "icon" : "emoji"
  );
  const [iconGroup, setIconGroup] = useState<string>(
    () =>
      ICON_PICKER_GROUPS.find((g) =>
        (g.names as string[]).includes(value)
      )?.key ?? ICON_PICKER_GROUPS[0].key
  );
  const [emojiGroup, setEmojiGroup] = useState<string>(
    () => EMOJI_GROUPS.find((g) => g.emojis.includes(value))?.key ?? EMOJI_GROUPS[0].key
  );

  const isIcons = tab === "icon";
  // One shape for both tabs so the strip and the grid are written once.
  const groups = isIcons
    ? ICON_PICKER_GROUPS.map((g) => ({
        key: g.key,
        label: g.label,
        items: g.names as string[],
      }))
    : EMOJI_GROUPS.map((g) => ({ key: g.key, label: g.label, items: g.emojis }));
  const groupKey = isIcons ? iconGroup : emojiGroup;
  const setGroupKey = isIcons ? setIconGroup : setEmojiGroup;
  const activeGroup = groups.find((g) => g.key === groupKey) ?? groups[0];

  return (
    <div className="rounded-lg border border-(--border) bg-(--background)/40 p-2 space-y-2">
      <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-(--card)">
        {(["icon", "emoji"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-pressed={tab === k}
            className={cn(
              "py-1.5 rounded-md text-xs font-medium transition",
              tab === k
                ? "bg-(--accent)/20 text-(--foreground)"
                : "text-(--muted) hover:text-(--foreground)"
            )}
          >
            {k === "icon" ? t("categories.iconTab") : t("categories.emojiTab")}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {/* Group strip — emoji chips so the row stays scannable at 13
            groups, on both tabs. */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-2 px-2 pb-1">
          {groups.map((g) => {
            const isActive = g.key === groupKey;
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroupKey(g.key)}
                aria-pressed={isActive}
                aria-label={g.key}
                className={cn(
                  "shrink-0 h-8 w-8 rounded-md flex items-center justify-center text-base leading-none transition",
                  isActive
                    ? "bg-(--accent)/20 ring-2 ring-(--accent)/50"
                    : "bg-(--card) hover:bg-(--background)"
                )}
              >
                <EmojiOrIcon value={g.label} size={20} />
              </button>
            );
          })}
        </div>
        <div className="max-h-56 sm:max-h-64 overflow-y-auto pr-1">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
            {activeGroup.items.map((item, idx) => {
              const isActive = value === item;
              return (
                <button
                  key={`${item}-${idx}`}
                  type="button"
                  onClick={() => onChange(item)}
                  aria-label={item}
                  aria-pressed={isActive}
                  className={cn(
                    "aspect-square rounded-lg flex items-center justify-center text-xl leading-none transition",
                    isActive
                      ? "bg-(--accent)/15 ring-2 ring-(--accent)/50"
                      : "hover:bg-(--card)"
                  )}
                >
                  {isIcons ? (
                    <JtIcon name={item as IconName} size={22} />
                  ) : (
                    <EmojiOrIcon value={item} size={24} lazy />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal sheet that lets the user pick a source ledger to copy
 * categories from. List shows every ledger they have read access to
 * except the active one. Tap a row → confirm → run the server
 * action → close with a result toast (rendered inline so we don't
 * depend on a toast system).
 */
function CopyFromLedgerSheet({
  ledgers,
  onClose,
}: {
  ledgers: OtherLedger[];
  onClose: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ copied: number; skipped: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function pick(ledgerId: string, name: string) {
    if (!confirm(t("categories.copyConfirm", { name }))) return;
    setError(null);
    setBusyId(ledgerId);
    startTransition(async () => {
      const r = await copyCategoriesFromLedgerAction(ledgerId);
      setBusyId(null);
      if (r.ok === false) {
        setError(r.error);
        return;
      }
      setResult({ copied: r.copied, skipped: r.skipped });
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,440px)] max-h-[85vh] overflow-y-auto rounded-2xl soft-raised-sm shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{t("categories.copyTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="p-1.5 rounded-lg text-(--muted) hover:bg-(--background)"
          >
            <JtIcon name="x" size={20} />
          </button>
        </div>
        <p className="text-xs text-(--muted)">{t("categories.copyHint")}</p>

        {result && (
          <div className="rounded-lg bg-(--income)/10 text-(--income) px-3 py-2 text-sm">
            {t("categories.copyResult", {
              copied: result.copied,
              skipped: result.skipped,
            })}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-(--expense)/10 text-(--expense) px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <ul className="space-y-1.5">
          {ledgers.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => pick(l.id, l.name)}
                disabled={pending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[16px] soft-raised hover:bg-(--background) transition disabled:opacity-50 text-left"
              >
                <span className="shrink-0">
                  <EmojiOrIcon value={l.icon} fallback="ledgers" size={22} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{l.name}</p>
                  <p className="text-[11px] text-(--muted)">
                    {l.isPersonal
                      ? t("ledgers.personal")
                      : t("categories.copyShared")}
                  </p>
                </div>
                {busyId === l.id ? (
                  <JtIcon
                    name="loader-2"
                    size={18}
                    className="animate-spin text-(--accent)"
                  />
                ) : (
                  <JtIcon name="chevron-right" size={18} className="text-(--muted)" />
                )}
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="w-full px-3 py-2 rounded-[16px] soft-raised hover:bg-(--background) text-sm font-medium"
        >
          {result ? t("common.close") : t("common.cancel")}
        </button>
      </div>
    </>
  );
}
