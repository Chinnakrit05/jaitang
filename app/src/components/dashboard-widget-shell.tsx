"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, RotateCcw, X } from "lucide-react";
import {
  DEFAULT_LAYOUT,
  loadLayout,
  moveItem,
  saveLayout,
  setVisible,
  WIDGET_IDS,
  type Layout,
  type WidgetId,
} from "@/lib/dashboard-layout";

export type WidgetMap = Partial<Record<WidgetId, ReactNode>>;

/**
 * Renders dashboard widgets in user-customized order. Server renders all
 * widgets and passes them in via `widgets`; this client shell:
 *   1. Loads layout from localStorage (defaults to canonical order).
 *   2. Filters/reorders the widgets based on layout state.
 *   3. Exposes an "Edit layout" panel where the user can move widgets
 *      up/down or hide/show them. Changes persist immediately.
 *
 * Hydration order: the very first paint uses DEFAULT_LAYOUT (server-side
 * render is deterministic). After mount we swap in the saved layout.
 * This may cause a brief flash for users who heavily customized — fine
 * for v1; SSR-cookie-based hydration is the next-step upgrade.
 */
export function DashboardWidgetShell({ widgets }: { widgets: WidgetMap }) {
  const t = useTranslations();
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLayout(loadLayout());
    setHydrated(true);
  }, []);

  function commit(next: Layout) {
    setLayout(next);
    saveLayout(next);
  }

  function move(index: number, dir: -1 | 1) {
    commit(moveItem(layout, index, index + dir));
  }

  function toggle(id: WidgetId, visible: boolean) {
    commit(setVisible(layout, id, visible));
  }

  function reset() {
    commit(DEFAULT_LAYOUT);
  }

  const widgetLabel: Record<WidgetId, string> = {
    summary: t("dashboard.widgetSummary"),
    expenseByCategory: t("dashboard.widgetExpenseByCategory"),
    dailyTrend: t("dashboard.widgetDailyTrend"),
    accountBalances: t("dashboard.widgetAccountBalances"),
    paymentMethod: t("dashboard.widgetPaymentMethod"),
    recent: t("dashboard.widgetRecent"),
  };

  const hidden = layout.filter((it) => !it.visible);

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
              <X size={14} />
              {t("dashboard.layoutDone")}
            </>
          ) : (
            <>
              <Pencil size={14} />
              {t("dashboard.layoutEdit")}
            </>
          )}
        </button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-(--border) bg-(--card) p-4 space-y-2 fade-rise">
          <ul className="space-y-1.5">
            {layout.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-(--background) transition"
              >
                <span
                  className={`flex-1 text-sm font-medium truncate ${
                    item.visible ? "" : "text-(--muted) line-through"
                  }`}
                >
                  {widgetLabel[item.id]}
                </span>
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t("dashboard.layoutMoveUp")}
                  title={t("dashboard.layoutMoveUp")}
                  className="p-1.5 rounded-md hover:bg-(--card) disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === layout.length - 1}
                  aria-label={t("dashboard.layoutMoveDown")}
                  title={t("dashboard.layoutMoveDown")}
                  className="p-1.5 rounded-md hover:bg-(--card) disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(item.id, !item.visible)}
                  aria-label={
                    item.visible
                      ? t("dashboard.layoutHide")
                      : t("dashboard.layoutShow")
                  }
                  title={
                    item.visible
                      ? t("dashboard.layoutHide")
                      : t("dashboard.layoutShow")
                  }
                  className="p-1.5 rounded-md hover:bg-(--card) text-(--muted) hover:text-(--foreground)"
                >
                  {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between pt-2 border-t border-(--border)">
            <span className="text-xs text-(--muted)">
              {hidden.length === 0
                ? t("dashboard.layoutEmpty")
                : `${t("dashboard.layoutHidden")}: ${hidden
                    .map((it) => widgetLabel[it.id])
                    .join(", ")}`}
            </span>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs text-(--muted) hover:text-(--foreground) px-2 py-1 rounded-md hover:bg-(--background)"
            >
              <RotateCcw size={12} />
              {t("dashboard.layoutReset")}
            </button>
          </div>
        </div>
      )}

      {/* The widgets themselves — render only those marked visible, in
          the user's chosen order. Use a key on the outer fragment that
          changes after hydration so React doesn't try to reconcile the
          server-rendered "all visible / default order" tree with the
          customized tree (and break inner client state). */}
      <div className="space-y-6" key={hydrated ? "client" : "ssr"}>
        {layout
          .filter((it) => it.visible)
          .map((it) => {
            const node = widgets[it.id];
            if (!node) return null;
            return <div key={it.id}>{node}</div>;
          })}
      </div>
    </>
  );
}
