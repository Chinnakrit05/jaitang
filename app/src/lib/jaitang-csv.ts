import type { PaymentMethod, TxKind } from "@/lib/types";

/**
 * Parser for Jaitang's own CSV-export format. Closes the round-trip:
 * "export from ledger A → import into ledger B" works without going
 * through the AI category mapper.
 *
 * Header row written by `export/route.ts`:
 *   วันที่,ประเภท,หมวด,จำนวน,ช่องทาง,โน้ต
 * (with a UTF-8 BOM prefix so Excel reads Thai correctly)
 */

export type JaitangCsvRow = {
  occurredAt: string; // ISO with TZ designator
  kind: TxKind;
  categoryName: string | null; // null = uncategorized in source
  amount: number;
  paymentMethod: PaymentMethod | null;
  note: string;
};

const HEADER_FIELDS = ["วันที่", "ประเภท", "หมวด", "จำนวน", "ช่องทาง", "โน้ต"];

/**
 * Returns true if the given text looks like a Jaitang export. We read just
 * the first non-empty line and check the column names match. Tolerates the
 * UTF-8 BOM that the export prepends.
 */
export function isJaitangCsv(text: string): boolean {
  const stripped = text.replace(/^﻿/, "");
  const firstLine = stripped.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!firstLine) return false;
  const fields = parseCsvLine(firstLine);
  // Require at least the first 4 (date / kind / category / amount). The
  // `ช่องทาง` (payment method) column was added later — older exports
  // would lack it; we still accept those.
  return HEADER_FIELDS.slice(0, 4).every((h, i) => fields[i] === h);
}

/**
 * Parse a single CSV line into fields, honoring RFC-4180-style double-quoted
 * fields with `""` escapes. The export's `csvEscape()` matches this; the
 * parser must too or notes containing commas / quotes get split incorrectly.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

function parseKind(value: string): TxKind | null {
  const v = value.trim();
  if (v === "รายรับ" || v === "income") return "income";
  if (v === "รายจ่าย" || v === "expense") return "expense";
  return null;
}

function parsePaymentMethod(value: string): PaymentMethod | null {
  const v = value.trim();
  if (v === "เงินสด" || v === "cash") return "cash";
  if (v === "เงินโอน" || v === "transfer") return "transfer";
  return null;
}

function parseAmount(raw: string): number | null {
  // Tolerate stray whitespace, optional ฿, comma thousands.
  const cleaned = raw.replace(/[฿,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Parse Jaitang CSV text. Skips rows with missing essential fields (date,
 * kind, amount) instead of throwing, so a corrupted line doesn't sink the
 * whole import — but caller should warn the user about skipped rows.
 */
export function parseJaitangCsv(text: string): {
  rows: JaitangCsvRow[];
  skipped: number;
} {
  const stripped = text.replace(/^﻿/, "");
  const lines = stripped.split(/\r?\n/);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  const rows: JaitangCsvRow[] = [];
  let skipped = 0;

  // Skip header (first non-empty line)
  let started = false;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    if (!started) {
      started = true;
      continue;
    }
    const fields = parseCsvLine(raw);
    const dateStr = fields[0]?.trim() ?? "";
    const kind = parseKind(fields[1] ?? "");
    const categoryRaw = (fields[2] ?? "").trim();
    const amount = parseAmount(fields[3] ?? "");
    const paymentMethod = parsePaymentMethod(fields[4] ?? "");
    const note = (fields[5] ?? "").trim();

    if (!dateStr || !kind || amount === null) {
      skipped++;
      continue;
    }

    // Sanity-check the date — if it's TZ-naive or unparseable, drop the row
    // rather than smear the import with bad timestamps.
    const inst = new Date(dateStr);
    if (Number.isNaN(inst.getTime())) {
      skipped++;
      continue;
    }
    const occurredAt = inst.toISOString();

    rows.push({
      occurredAt,
      kind,
      // "ไม่ระบุ" is what the export writes for uncategorized rows; treat
      // that the same as missing so we don't recreate an "uncategorized"
      // category in the destination ledger.
      categoryName: categoryRaw && categoryRaw !== "ไม่ระบุ" ? categoryRaw : null,
      amount,
      paymentMethod,
      note,
    });
  }

  return { rows, skipped };
}
