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
  /** Trip name from the source ledger. Free text, may match an existing
   *  trip in the destination ledger or not. v1: ignored on import — see
   *  comment in actions.ts for the rationale. */
  tripName: string | null;
  note: string;
};

// Header field order matters only for the row parser; the detector below
// just checks the FIRST FOUR columns so older exports without ช่องทาง / ทริป
// are still recognized.
const HEADER_FIELDS = [
  "วันที่",
  "ประเภท",
  "หมวด",
  "จำนวน",
  "ช่องทาง",
  "ทริป",
  "โน้ต",
];

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
 *
 * Adapts to old / new export shapes by reading the header and locating
 * each known column by name. That way an old export (6 cols, no ทริป)
 * and a new one (7 cols, with ทริป) both parse correctly.
 */
export function parseJaitangCsv(text: string): {
  rows: JaitangCsvRow[];
  skipped: number;
} {
  const stripped = text.replace(/^﻿/, "");
  const lines = stripped.split(/\r?\n/);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  // Find the header (first non-empty line) and build a field-name → index map.
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { rows: [], skipped: 0 };

  const header = parseCsvLine(lines[headerIdx]).map((s) => s.trim());
  const idx = (name: string) => header.indexOf(name);
  const dateCol = idx("วันที่") >= 0 ? idx("วันที่") : 0;
  const kindCol = idx("ประเภท") >= 0 ? idx("ประเภท") : 1;
  const catCol = idx("หมวด") >= 0 ? idx("หมวด") : 2;
  const amountCol = idx("จำนวน") >= 0 ? idx("จำนวน") : 3;
  const methodCol = idx("ช่องทาง"); // -1 in legacy 6-col exports (OK)
  const tripCol = idx("ทริป"); // -1 in pre-trip exports (OK)
  const noteCol = idx("โน้ต") >= 0 ? idx("โน้ต") : header.length - 1;

  const rows: JaitangCsvRow[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const fields = parseCsvLine(raw);

    const dateStr = (fields[dateCol] ?? "").trim();
    const kind = parseKind(fields[kindCol] ?? "");
    const categoryRaw = (fields[catCol] ?? "").trim();
    const amount = parseAmount(fields[amountCol] ?? "");
    const paymentMethod =
      methodCol >= 0 ? parsePaymentMethod(fields[methodCol] ?? "") : null;
    const tripRaw = tripCol >= 0 ? (fields[tripCol] ?? "").trim() : "";
    const note = (fields[noteCol] ?? "").trim();

    if (!dateStr || !kind || amount === null) {
      skipped++;
      continue;
    }

    const inst = new Date(dateStr);
    if (Number.isNaN(inst.getTime())) {
      skipped++;
      continue;
    }
    const occurredAt = inst.toISOString();

    rows.push({
      occurredAt,
      kind,
      categoryName: categoryRaw && categoryRaw !== "ไม่ระบุ" ? categoryRaw : null,
      amount,
      paymentMethod,
      tripName: tripRaw || null,
      note,
    });
  }

  return { rows, skipped };
}
