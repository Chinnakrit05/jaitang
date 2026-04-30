import JSZip from "jszip";

export type ParsedRow = {
  /** original CSV filename (e.g. "Sep68✔️-ค่าใช้จ่าย.csv") */
  source: string;
  /** ISO date assigned for this row, end-of-month-safe (28th) */
  occurredAt: string;
  /** "income" or "expense" inferred from filename */
  kind: "income" | "expense";
  /** raw label from the CSV — passed to AI for category mapping */
  note: string;
  /** parsed amount (positive number) */
  amount: number;
};

/** "Sep68" → year 2025, month 9 (Buddhist 2568 → Gregorian 2025) */
function parseFilenameMonth(name: string): { year: number; month: number } | null {
  const m = name.match(
    /(Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)(\d{2})/i
  );
  if (!m) return null;
  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  };
  const month = monthMap[m[1].toLowerCase()];
  if (!month) return null;
  // 2-digit Buddhist year (67/68/...) → Gregorian
  const beShort = parseInt(m[2], 10);
  const beFull = 2500 + beShort;
  const year = beFull - 543;
  return { year, month };
}

function parseAmount(raw: string): number | null {
  // Handles "฿4,000", "฿725", "-฿16,983", "฿0"
  const cleaned = raw.replace(/[฿,\s"]/g, "").trim();
  if (!cleaned || cleaned === "0") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n);
}

function isSummaryLabel(label: string): boolean {
  const trimmed = label.trim();
  return (
    trimmed === "รายจ่าย" ||
    trimmed === "รายรับ" ||
    trimmed === "ค่าใช้จ่ายทั้งหมด" ||
    trimmed === "รายได้ทั้งหมด" ||
    trimmed === "เงินที่เหลือ" ||
    trimmed === "รายได้ลบค่าใช้จ่าย"
  );
}

function inferKind(filename: string): "income" | "expense" | null {
  if (filename.includes("รายได้") || filename.includes("รายรับ")) return "income";
  if (filename.includes("ค่าใช้จ่าย") || filename.includes("รายจ่าย")) return "expense";
  if (filename.includes("สุทธิ")) return null; // skip net summaries
  return null;
}

/**
 * Parse a Numbers-export CSV. Lines look like `<label>,<amount>` with
 * Thai labels, ฿-prefixed values, and quoted comma-thousands. Returns
 * one row per non-summary, non-zero entry.
 */
export function parseCsvText(text: string): Array<{ note: string; amount: number }> {
  const rows: Array<{ note: string; amount: number }> = [];
  // Naive RFC-4180 parser: each line is `field1,field2`. Field2 may be quoted
  // with embedded commas. No newlines inside fields in this dataset.
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    if (!raw.trim()) continue;
    // Split on the FIRST comma not inside quotes
    let comma = -1;
    let inQuotes = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === "," && !inQuotes) {
        comma = i;
        break;
      }
    }
    if (comma === -1) continue;
    const label = raw.slice(0, comma).replace(/^"|"$/g, "").trim();
    const value = raw.slice(comma + 1).replace(/^"|"$/g, "").trim();
    if (!label || isSummaryLabel(label)) continue;
    const amt = parseAmount(value);
    if (!amt) continue;
    rows.push({ note: label, amount: amt });
  }
  return rows;
}

export type ParsedFile = {
  filename: string;
  year: number;
  month: number;
  kind: "income" | "expense";
  rows: Array<{ note: string; amount: number }>;
};

export async function parseZipBuffer(buf: ArrayBuffer): Promise<ParsedFile[]> {
  const zip = await JSZip.loadAsync(buf);
  const out: ParsedFile[] = [];
  const entries = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".csv")
  );
  for (const f of entries) {
    const kind = inferKind(f.name);
    if (!kind) continue;
    const ym = parseFilenameMonth(f.name);
    if (!ym) continue;
    const text = await f.async("string");
    const rows = parseCsvText(text);
    if (rows.length === 0) continue;
    out.push({
      filename: f.name,
      year: ym.year,
      month: ym.month,
      kind,
      rows,
    });
  }
  // Stable order: oldest first
  return out.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );
}

/** Pick a safe date in the given month — day 28 avoids Feb edge cases. */
export function monthDate(year: number, month: number, day = 28): string {
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.toISOString();
}

export function flattenToRows(files: ParsedFile[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const f of files) {
    const occurredAt = monthDate(f.year, f.month);
    for (const r of f.rows) {
      rows.push({
        source: f.filename,
        occurredAt,
        kind: f.kind,
        note: r.note,
        amount: r.amount,
      });
    }
  }
  return rows;
}
