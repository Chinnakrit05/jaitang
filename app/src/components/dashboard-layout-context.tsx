"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";
import {
  DEFAULT_LAYOUT,
  loadLayout,
  saveLayout,
  type Layout,
} from "@/lib/dashboard-layout";

/**
 * Shared editing + layout state for the dashboard widget grid.
 *
 * Lifted out of `DashboardWidgetShell` so the edit/done/reset toolbar
 * can render at the top-right of the page (above the hero card) while
 * the widget shell still consumes the same state. Both pieces live
 * inside the same `DashboardLayoutProvider`.
 */

type LayoutContextValue = {
  editing: boolean;
  setEditing: (v: boolean) => void;
  layout: Layout;
  setLayout: (layout: Layout) => void;
  reset: () => void;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function DashboardLayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [layout, setLayoutState] = useState<Layout>(DEFAULT_LAYOUT);

  // Hydrate from localStorage on mount. The server can't read it, so
  // the first render uses DEFAULT_LAYOUT and the saved layout takes
  // over after hydration. The state update is wrapped in RAF so it
  // isn't synchronous inside the effect (avoids cascading renders).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setLayoutState(loadLayout());
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  function setLayout(next: Layout) {
    setLayoutState(next);
    saveLayout(next);
  }

  function reset() {
    setLayout(DEFAULT_LAYOUT);
  }

  return (
    <LayoutContext.Provider
      value={{ editing, setEditing, layout, setLayout, reset }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useDashboardLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error(
      "useDashboardLayout must be used inside <DashboardLayoutProvider>"
    );
  }
  return ctx;
}

/**
 * Edit / Done (+ Reset when dirty) toolbar — rendered top-right of the
 * dashboard. Hidden during the first paint to avoid a hydration jump
 * when the saved layout shows it should already be the default.
 */
export function LayoutToolbar() {
  const t = useTranslations();
  const { editing, setEditing, layout, reset } = useDashboardLayout();

  // "Dirty" = visible items in non-default order OR any hidden item.
  // Cheap check: compare flattened state against DEFAULT_LAYOUT.
  const dirty = layout.some(
    (it, i) => it.id !== DEFAULT_LAYOUT[i]?.id || !it.visible
  );

  return (
    <div className="inline-flex items-center gap-1">
      {editing && dirty && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs text-(--muted) hover:text-(--foreground) px-2 py-1 rounded-md hover:bg-(--card)"
        >
          <JtIcon name="rotate-ccw" size={16} />
          {t("dashboard.layoutReset")}
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(!editing)}
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
    </div>
  );
}
