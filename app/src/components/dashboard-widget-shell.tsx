"use client";

import { useEffect, useState, type ReactNode } from "react";
import { JtIcon } from "@/components/icons";
import { useTranslations } from "next-intl";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  DEFAULT_LAYOUT,
  loadLayout,
  saveLayout,
  setVisible,
  type Layout,
  type WidgetId,
} from "@/lib/dashboard-layout";

export type WidgetMap = Partial<Record<WidgetId, ReactNode>>;

/**
 * Customizable dashboard. Server renders all widgets; this client shell:
 *   1. Loads layout from localStorage (defaults to canonical order).
 *   2. Renders visible widgets in a `@dnd-kit` SortableContext so the
 *      user can drag them to reorder.
 *   3. In edit mode: each widget shows a drag handle and a hide button.
 *      Hidden widgets are surfaced as chips at the bottom so they can
 *      be restored.
 *
 * Mobile: PointerSensor handles mouse + stylus, TouchSensor uses a
 * 180ms long-press so taps and scrolls don't accidentally start drags.
 */
export function DashboardWidgetShell({ widgets }: { widgets: WidgetMap }) {
  const t = useTranslations();
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  function commit(next: Layout) {
    setLayout(next);
    saveLayout(next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      // Long-press to start drag — keeps scroll/tap usable on mobile.
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = layout.map((it) => it.id);
    const from = ids.indexOf(active.id as WidgetId);
    const to = ids.indexOf(over.id as WidgetId);
    if (from === -1 || to === -1) return;
    commit(arrayMove(layout, from, to));
  }

  function toggle(id: WidgetId, visible: boolean) {
    commit(setVisible(layout, id, visible));
  }

  function reset() {
    commit(DEFAULT_LAYOUT);
  }

  const widgetLabel: Record<WidgetId, string> = {
    expenseByCategory: t("dashboard.widgetExpenseByCategory"),
    dailyTrend: t("dashboard.widgetDailyTrend"),
    accountBalances: t("dashboard.widgetAccountBalances"),
    paymentMethod: t("dashboard.widgetPaymentMethod"),
    recent: t("dashboard.widgetRecent"),
  };

  const visibleItems = layout.filter((it) => it.visible);
  const hiddenItems = layout.filter((it) => !it.visible);
  const visibleIds = visibleItems.map((it) => it.id);

  return (
    <>
      <div className="flex items-center justify-between gap-2 -mt-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-(--muted) hover:text-(--foreground) transition px-2 py-1 rounded-md hover:bg-(--card)"
        >
          {editing ? (
            <>
              <JtIcon name="x" size={18} />
              {t("dashboard.layoutDone")}
            </>
          ) : (
            <>
              <JtIcon name="pencil" size={18} />
              {t("dashboard.layoutEdit")}
            </>
          )}
        </button>
        {editing && layout.some((it, i) => it.id !== DEFAULT_LAYOUT[i]?.id || !it.visible) && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs text-(--muted) hover:text-(--foreground) px-2 py-1 rounded-md hover:bg-(--card)"
          >
            <JtIcon name="rotate-ccw" size={16} />
            {t("dashboard.layoutReset")}
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {visibleItems.map((item) => {
              const node = widgets[item.id];
              if (!node) return null;
              return (
                <SortableWidget
                  key={item.id}
                  id={item.id}
                  label={widgetLabel[item.id]}
                  editing={editing}
                  onHide={() => toggle(item.id, false)}
                  hideLabel={t("dashboard.layoutHide")}
                >
                  {node}
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {editing && hiddenItems.length > 0 && (
        <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/40 p-4 fade-rise">
          <div className="text-xs uppercase tracking-wide text-(--muted) mb-2 font-medium">
            {t("dashboard.layoutHidden")}
          </div>
          <div className="flex flex-wrap gap-2">
            {hiddenItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id, true)}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-(--border) bg-(--card) hover:bg-(--background) transition"
              >
                <JtIcon name="plus-fab" size={18} />
                {widgetLabel[item.id]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SortableWidget({
  id,
  label,
  editing,
  children,
  onHide,
  hideLabel,
}: {
  id: WidgetId;
  label: string;
  editing: boolean;
  children: ReactNode;
  onHide: () => void;
  hideLabel: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged widget visually so the user knows it's "in hand".
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.92 : undefined,
    boxShadow: isDragging
      ? "0 12px 32px -8px color-mix(in srgb, var(--accent) 40%, transparent)"
      : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {editing && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-(--card)/90 backdrop-blur rounded-lg border border-(--border) p-1 shadow-sm">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={label}
            title={label}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-(--muted) hover:text-(--foreground) hover:bg-(--background) cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={16} />
          </button>
          <button
            type="button"
            onClick={onHide}
            aria-label={hideLabel}
            title={hideLabel}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-(--muted) hover:text-(--expense) hover:bg-(--background)"
          >
            <JtIcon name="eye-off" size={18} />
          </button>
        </div>
      )}
      {/* Edit-mode visual cue: dashed accent ring around each widget so
          the user knows the widget is the draggable unit. */}
      {editing && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl border-2 border-dashed pointer-events-none"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
          }}
        />
      )}
      {children}
    </div>
  );
}
