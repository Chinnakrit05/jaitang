export type RangeKey = "month" | "prev" | "30d" | "ytd" | "all";

export function resolveRange(key: string | undefined): { from?: string; to?: string; label: string } {
  const now = new Date();
  const k = (key ?? "month") as RangeKey;

  switch (k) {
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from: from.toISOString(), to: to.toISOString(), label: "เดือนนี้" };
    }
    case "prev": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString(), to: to.toISOString(), label: "เดือนก่อน" };
    }
    case "30d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to: now.toISOString(), label: "30 วันล่าสุด" };
    }
    case "ytd": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: from.toISOString(), to: now.toISOString(), label: "ปีนี้" };
    }
    case "all":
    default:
      return { label: "ทั้งหมด" };
  }
}
