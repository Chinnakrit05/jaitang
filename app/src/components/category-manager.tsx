"use client";

import { useState, useTransition } from "react";
import { JtIcon, EmojiOrIcon, type IconName } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { Category, TxKind } from "@/lib/types";
import {
  copyCategoriesFromLedgerAction,
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

// Curated icon library for the category picker. Wider than the
// original 14 because the click-to-cycle UX got tedious once we had
// more than ~6 categories; the new grid picker shows them all at
// once. Grouped loosely by use case so the spatial layout maps to
// "what kind of thing am I logging" — food first, transport, etc.
// Two old emoji choices (shirt 👕, dog 🐶) still don't have a Sticker
// Pop equivalent so they're omitted; categories that picked those
// previously still render fine via EmojiOrIcon at display time.
const PRESET_ICONS: IconName[] = [
  // Food + drink
  "ramen", "coffee",
  // Transport + travel
  "car", "airplane", "cruise-ship", "backpack", "mountain", "beach", "camping",
  // Shopping + lifestyle
  "shopping-cart", "gift", "tag",
  // Home + bills
  "house", "pill", "shield-check",
  // Tech + entertainment
  "laptop", "smartphone", "game-controller", "books", "party", "mic", "volume-2",
  // Money + finance
  "money-bag", "piggy-bank", "credit-card", "cash-stack", "gold-coin", "bitcoin",
  // Other catch-all
  "award", "graduation-cap", "target-domain", "flame", "sparkle",
];
const DEFAULT_CATEGORY_ICON: IconName = "sparkle";

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
  const [tab, setTab] = useState<TxKind>("expense");
  const [showCopyPicker, setShowCopyPicker] = useState(false);

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
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-(--card) border border-(--border) hover:bg-(--background) transition"
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
        <span
          aria-label={t("ledgers.icon")}
          className="px-3 py-2 rounded-lg border border-(--border) bg-(--background) flex items-center justify-center shrink-0"
        >
          <EmojiOrIcon value={icon} size={28} />
        </span>
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

      {/* Visible icon picker grid — tap any tile to set the create
          icon. Replaces the old click-to-cycle button so the user
          can see all options at once. */}
      <IconPickerGrid value={icon} onChange={setIcon} />
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
        <div className="flex-1 flex flex-col gap-2">
          {/* Name + live icon preview. Action buttons live on their
              own row below (full-width text labels) — the previous
              icon-only check/x inside this header row got lost next
              to the parent dropdown on narrow mobile widths. */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg border border-(--border) bg-(--background) flex items-center justify-center shrink-0">
              <EmojiOrIcon value={icon} size={26} />
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="flex-1 px-2 py-1.5 rounded-lg border border-(--border) bg-(--background)"
              autoFocus
            />
          </div>
          {eligibleParents.length > 0 && (
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-(--border) bg-(--background) text-sm"
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
              visible without scrolling past 50 tiles. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(category.name);
                setIcon(category.icon ?? DEFAULT_CATEGORY_ICON);
                setParentId(category.parent_id ?? "");
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium"
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
          <IconPickerGrid value={icon} onChange={setIcon} />
        </div>
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

/**
 * Curated emoji library for category icons. Stored as raw emoji
 * strings in the same `icon` column the JtIcon names use —
 * `EmojiOrIcon` branches on whether the value matches an icon name
 * and falls through to render the emoji directly otherwise.
 *
 * Grouped so the picker can render a sub-tab strip (food, transport,
 * etc.) and the user can jump straight to the relevant page instead
 * of scrolling through a 300-tile wall.
 */
const EMOJI_GROUPS: Array<{ key: string; label: string; emojis: string[] }> = [
  {
    key: "food",
    label: "🍜",
    emojis: [
      "🍜","🍝","🍲","🍛","🍚","🍱","🍙","🍘","🍣","🍤","🍡","🍢","🍧","🍨","🍦","🥮",
      "🍰","🧁","🍪","🍩","🍫","🍬","🍭","🍮","🥧","🥐","🥯","🥖","🍞","🧀","🥚","🍳",
      "🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🌮","🌯","🥙","🍿","🧂","🍿","🥗",
      "🍵","☕","🥛","🍺","🍻","🍷","🍸","🍹","🍶","🥃","🍾","🥤","🧃","🧉","🧊",
    ],
  },
  {
    key: "fruit",
    label: "🍎",
    emojis: [
      "🍎","🍏","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥝","🥥",
      "🥑","🫒","🍅","🌶️","🥬","🥒","🫑","🌽","🥕","🧄","🧅","🥔","🍠","🥦","🫛","🥜",
    ],
  },
  {
    key: "transport",
    label: "🚕",
    emojis: [
      "🚗","🚕","🚙","🚌","🚎","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🚲",
      "🛴","✈️","🛩️","🛫","🛬","🚀","🛸","🚁","🚂","🚄","🚆","🚇","🚊","⛴️","🚢","⛵",
      "🛥️","🚤","⛽","🚏","🚦","🛣️","🛤️","🅿️","🚏","🚧",
    ],
  },
  {
    key: "shopping",
    label: "🛍️",
    emojis: [
      "🛍️","🛒","💼","👜","👛","🎒","🧳","👕","👔","👗","👚","👙","👘","🥻","🩱","🩳",
      "👖","🧦","👟","👞","👠","👡","👢","🥾","🥿","💄","💍","👑","🎩","🧢","🕶️","🧥",
      "🥼","👓","🧤","🧣","🎀",
    ],
  },
  {
    key: "home",
    label: "🏠",
    emojis: [
      "🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏪","🏫","🏬","🏭","🏯","🏰","💒","🛏️",
      "🛋️","🚪","🪑","🚽","🚿","🛁","💡","🕯️","🔌","🪫","🔋","💧","🔥","🧴","🧼","🧽",
      "🧹","🧺","🪣","🪥","🧻","🚰","🪟","🪞","🧯","📺","📻",
    ],
  },
  {
    key: "health",
    label: "💊",
    emojis: [
      "💊","💉","🩺","🩹","🩼","🦽","🦼","🦷","🧴","🧖","🧘","🏥","🩸","🤒","🤕","🤧",
      "😷","🫀","🫁","🧠","👁️","👂","👃","👄","🦴","🥼","🚑","♿","🚭","🧬",
    ],
  },
  {
    key: "tech",
    label: "💻",
    emojis: [
      "📱","📲","💻","🖥️","⌨️","🖱️","🖨️","💾","💿","📀","📷","📸","📹","🎥","📺","📻",
      "🎙️","🎧","☎️","📞","📠","⏰","⌚","⏱️","⏲️","🔋","🪫","🔌","💡","🧰","🔧","🔨",
      "⚙️","🪛","🔩","🛠️","📡","🛰️","📟","📺",
    ],
  },
  {
    key: "money",
    label: "💰",
    emojis: [
      "💰","💵","💴","💶","💷","💸","💳","🪙","🧾","📊","📈","📉","🏦","🏧","💱","💲",
      "🪪","📑","🧮","💎","🏆","🥇","🥈","🥉","🎁","🛍️","💼","📒","📓","📔",
    ],
  },
  {
    key: "fun",
    label: "🎮",
    emojis: [
      "🎮","🕹️","🎯","🎲","🎰","🎨","🎭","🎬","🎤","🎼","🎵","🎶","🎟️","🎫","🎉","🎊",
      "🎁","🎈","🎂","🍰","🎏","🎎","🎴","🃏","🪅","🪆","🧧","🎆","🎇","🎐","🎑","🧸",
      "🪁","🪀","⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🥅","⛳",
      "🏹","🎣","🥊","🥋","🎽","🛹","🛼","⛸️","🎿","⛷️","🏂","🏋️","🤸","⛹️",
    ],
  },
  {
    key: "animal",
    label: "🐶",
    emojis: [
      "🐶","🐕","🦮","🐩","🐱","🐈","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁",
      "🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐺","🐗",
      "🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🪲","🐢","🐍","🦎","🦂","🕷️","🐙","🦑",
      "🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦌","🦒",
    ],
  },
  {
    key: "nature",
    label: "🌳",
    emojis: [
      "🌲","🌳","🌴","🌵","🌱","🌿","☘️","🍀","🎍","🎋","🍃","🍂","🍁","🌾","🌺","🌻",
      "🌼","🌷","🥀","🌹","🌸","💐","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑",
      "🌒","🌓","🌔","⭐","🌟","💫","✨","🌌","⚡","🔥","💧","🌊","☔","☂️","❄️","☃️","⛄",
    ],
  },
  {
    key: "work",
    label: "💼",
    emojis: [
      "💼","📝","📋","📊","📂","📁","📅","📆","🗓️","✏️","🖊️","🖋️","🖌️","🖍️","📚","📖",
      "📓","📔","📒","📕","📗","📘","📙","📰","🗞️","🔍","🔎","⚒️","🛠️","🪚","🔧","🔨",
      "⛏️","🪓","🧰","🪛","⚙️","🔩","⚖️","🪜","📌","📍","📎","🖇️","🗂️","📑","📇",
    ],
  },
  {
    key: "love",
    label: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💝","💖","💞","💕","💔","❣️","💋",
      "💯","💢","💥","💫","💦","💨","💬","💭","🗯️","😀","😃","😄","😁","😆","🥹","😅",
      "😂","🤣","🥰","😍","🤩","😘","😋","😎","🤓","🧐","😏","😢","😭","😤","😡","🤬",
    ],
  },
];

/** Flat lookup of every emoji we know about — used to detect whether
 *  the stored `icon` value lives in the emoji or the JtIcon bucket. */
const ALL_PRESET_EMOJIS = new Set(
  EMOJI_GROUPS.flatMap((g) => g.emojis)
);

/**
 * Inline picker for the category create + edit forms. Two tabs:
 *   - Icons → curated JtIcons (PRESET_ICONS)
 *   - Emoji → 400+ emoji bucketed into category strips
 *
 * Emoji tab adds a second row of group pills (food / transport /
 * shopping / …) so the user can jump straight to the relevant page
 * instead of scrolling through every option. The grid itself caps
 * height + scrolls vertically so a long group doesn't push the
 * Save button off-screen.
 *
 * Tap a tile to pick; selected tile lights up with the accent. The
 * stored `icon` column accepts either kind — display goes through
 * <EmojiOrIcon> which branches on whether the value matches an icon
 * name.
 */
function IconPickerGrid({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const t = useTranslations();
  // Default to whichever bucket the current value is in so the user
  // sees their existing pick selected on open.
  const valueIsEmoji =
    ALL_PRESET_EMOJIS.has(value) || !PRESET_ICONS.includes(value as IconName);
  const [tab, setTab] = useState<"icons" | "emoji">(
    valueIsEmoji ? "emoji" : "icons"
  );
  // Open the emoji group that contains the current value, falling
  // back to the first group otherwise.
  const initialEmojiGroup =
    EMOJI_GROUPS.find((g) => g.emojis.includes(value))?.key ??
    EMOJI_GROUPS[0].key;
  const [emojiGroup, setEmojiGroup] = useState<string>(initialEmojiGroup);
  const activeGroup =
    EMOJI_GROUPS.find((g) => g.key === emojiGroup) ?? EMOJI_GROUPS[0];

  return (
    <div className="rounded-lg border border-(--border) bg-(--background)/40 p-2 space-y-2">
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-(--card) rounded-md text-xs font-medium">
        <button
          type="button"
          onClick={() => setTab("icons")}
          aria-pressed={tab === "icons"}
          className={cn(
            "py-1 rounded transition",
            tab === "icons"
              ? "bg-(--accent) text-(--accent-foreground)"
              : "text-(--muted)"
          )}
        >
          {t("categories.iconTab")}
        </button>
        <button
          type="button"
          onClick={() => setTab("emoji")}
          aria-pressed={tab === "emoji"}
          className={cn(
            "py-1 rounded transition",
            tab === "emoji"
              ? "bg-(--accent) text-(--accent-foreground)"
              : "text-(--muted)"
          )}
        >
          {t("categories.emojiTab")}
        </button>
      </div>

      {tab === "icons" ? (
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
          {PRESET_ICONS.map((name) => {
            const isActive = value === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onChange(name)}
                aria-label={name}
                aria-pressed={isActive}
                title={name}
                className={cn(
                  "aspect-square rounded-lg flex items-center justify-center transition",
                  isActive
                    ? "bg-(--accent)/15 ring-2 ring-(--accent)/50"
                    : "hover:bg-(--card)"
                )}
              >
                <EmojiOrIcon value={name} size={22} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Group strip — emoji labels as compact chips so the row
              stays scannable even with 13 groups. */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-2 px-2 pb-1">
            {EMOJI_GROUPS.map((g) => {
              const isActive = g.key === emojiGroup;
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setEmojiGroup(g.key)}
                  aria-pressed={isActive}
                  aria-label={g.key}
                  className={cn(
                    "shrink-0 h-8 w-8 rounded-md flex items-center justify-center text-base leading-none transition",
                    isActive
                      ? "bg-(--accent)/20 ring-2 ring-(--accent)/50"
                      : "bg-(--card) hover:bg-(--background)"
                  )}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          {/* Scrollable grid, capped so very long groups don't push
              the Save button off-screen. */}
          <div className="max-h-64 overflow-y-auto pr-1">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {activeGroup.emojis.map((e, idx) => {
                const isActive = value === e;
                return (
                  <button
                    key={`${e}-${idx}`}
                    type="button"
                    onClick={() => onChange(e)}
                    aria-label={e}
                    aria-pressed={isActive}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-xl leading-none transition",
                      isActive
                        ? "bg-(--accent)/15 ring-2 ring-(--accent)/50"
                        : "hover:bg-(--card)"
                    )}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
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
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,440px)] max-h-[85vh] overflow-y-auto rounded-2xl bg-(--card) border border-(--border) shadow-2xl p-5 space-y-4"
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) transition disabled:opacity-50 text-left"
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
          className="w-full px-3 py-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) text-sm font-medium"
        >
          {result ? t("common.close") : t("common.cancel")}
        </button>
      </div>
    </>
  );
}
