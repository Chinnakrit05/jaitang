export type RangeKey = "month" | "prev" | "30d" | "ytd" | "all";

/**
 * Resolve a UI range key into ISO date bounds. Returns the key alongside so
 * the caller can translate the label via the `transactions.rangeLabels.<key>` namespace.
 */
export function resolveRange(key: string | undefined): {
  from?: string;
  to?: string;
  key: RangeKey;
} {
  const now = new Date();
  const k = (key ?? "month") as RangeKey;

  switch (k) {
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from: from.toISOString(), to: to.toISOString(), key: "month" };
    }
    case "prev": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString(), to: to.toISOString(), key: "prev" };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to: now.toISOString(), key: "30d" };
    }
    case "ytd": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: from.toISOString(), to: now.toISOString(), key: "ytd" };
    }
    case "all":
    default:
      return { key: "all" };
  }
}
