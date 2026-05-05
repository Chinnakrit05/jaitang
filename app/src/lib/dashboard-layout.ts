/**
 * Dashboard layout — user-customizable widget order + visibility,
 * persisted in localStorage. Server renders all widgets in the default
 * order; the client shell reorders / hides them based on saved state.
 *
 * Schema is intentionally tolerant: when a new widget ID ships, old
 * saved layouts auto-append it at the end; unknown IDs are dropped.
 * Bumping `LAYOUT_VERSION` is only needed if the meaning of an ID
 * changes incompatibly.
 */

export const WIDGET_IDS = [
  "summary",
  "expenseByCategory",
  "dailyTrend",
  "accountBalances",
  "paymentMethod",
  "recent",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export type LayoutItem = { id: WidgetId; visible: boolean };
export type Layout = LayoutItem[];

export const DEFAULT_LAYOUT: Layout = WIDGET_IDS.map((id) => ({
  id,
  visible: true,
}));

const STORAGE_KEY = "jaitang.dashboard-layout.v1";

function isWidgetId(value: unknown): value is WidgetId {
  return (
    typeof value === "string" &&
    (WIDGET_IDS as readonly string[]).includes(value)
  );
}

export function loadLayout(): Layout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT;

    const out: Layout = [];
    const seen = new Set<WidgetId>();
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      if (!isWidgetId(obj.id)) continue;
      if (seen.has(obj.id)) continue;
      out.push({ id: obj.id, visible: obj.visible !== false });
      seen.add(obj.id);
    }
    // Heal: append any new widgets that the user hasn't seen yet.
    for (const id of WIDGET_IDS) {
      if (!seen.has(id)) out.push({ id, visible: true });
    }
    return out;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: Layout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage may throw in private mode or when disabled — ignore.
  }
}

export function moveItem(layout: Layout, from: number, to: number): Layout {
  if (from === to || from < 0 || to < 0 || from >= layout.length || to >= layout.length) {
    return layout;
  }
  const next = layout.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function setVisible(
  layout: Layout,
  id: WidgetId,
  visible: boolean
): Layout {
  return layout.map((it) => (it.id === id ? { ...it, visible } : it));
}
