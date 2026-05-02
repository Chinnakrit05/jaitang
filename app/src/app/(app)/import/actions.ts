"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, assertWritable } from "@/lib/session";
import { listCategories, createCategory } from "@/lib/categories";
import { createTransaction } from "@/lib/transactions";
import {
  flattenToRows,
  parseCsvText,
  parseZipBuffer,
  monthDate,
} from "@/lib/numbers-parser";
import { isJaitangCsv, parseJaitangCsv } from "@/lib/jaitang-csv";
import { mapNotesToCategories } from "@/lib/import-mapper";
import { listTrips } from "@/lib/trips";
import { yearMonthInTz } from "@/lib/utils";
import { BUSINESS_TZ } from "@/lib/business-tz";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";

export type PreviewRow = {
  id: string; // unique within plan, used as React key + final patch
  occurredAt: string;
  kind: TxKind;
  amount: number;
  note: string;
  source: string;
  categoryId: string | null;
  /** "create" + name + icon if a new category should be made on confirm */
  newCategoryName: string | null;
  newCategoryIcon: string | null;
  /** preserved through the round-trip — only set by the Jaitang CSV path */
  paymentMethod: PaymentMethod | null;
  /** id of the trip in the DESTINATION ledger that this row matched to,
   *  by exact-name lookup. Null if no match (or the source row had no trip). */
  tripId: string | null;
  /** Display-only trip name from the source CSV, surfaced in the wizard
   *  so the user can see which row is going to be tagged. Set even when
   *  tripId is null (= source had a trip but destination doesn't have a
   *  matching one — user can pre-create the trip and re-upload). */
  tripName: string | null;
};

export type ImportPreview = {
  ok: true;
  rows: PreviewRow[];
  knownCategories: Pick<Category, "id" | "name" | "icon" | "kind">[];
  /** counts by month for the summary card */
  monthSummary: Array<{ year: number; month: number; count: number; total: number }>;
};

/**
 * Step 1: parse upload + AI map. Returns a plan that the client can edit
 * before applying. We never insert anything here.
 */
export async function parseImportAction(
  formData: FormData
): Promise<ImportPreview | { ok: false; error: string }> {
  const { ledgerId, role } = await requireSession();
  assertWritable(role);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ไม่มีไฟล์อัปโหลด / no file uploaded" };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { ok: false, error: "ไฟล์ใหญ่เกิน 20 MB" };
  }

  const buf = await file.arrayBuffer();
  const lower = file.name.toLowerCase();

  // Branch 1: Jaitang's own CSV export. Detected by header row regardless
  // of filename — users may rename the download. AI mapping is skipped
  // because the source already names categories; we resolve them by string
  // match against the destination ledger and propose new ones for misses.
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder().decode(buf);
    if (isJaitangCsv(text)) {
      return previewJaitangCsv({ ledgerId, text, sourceName: file.name });
    }
  }

  let rows: ReturnType<typeof flattenToRows> = [];
  try {
    if (lower.endsWith(".zip")) {
      const files = await parseZipBuffer(buf);
      rows = flattenToRows(files);
    } else if (lower.endsWith(".csv")) {
      // Single-CSV upload: infer kind/month from filename (mirrors zip path)
      const text = new TextDecoder().decode(buf);
      const parsed = parseCsvText(text);
      // We need year/month from the filename — same logic as parser
      const m = file.name.match(
        /(Jan|Feb|Mar|Apr|May|June?|July?|Aug|Sept?|Oct|Nov|Dec)(\d{2})/i
      );
      const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, june: 6,
        jul: 7, july: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
      };
      const now = new Date();
      const year =
        m && monthMap[m[1].toLowerCase()]
          ? 2500 + parseInt(m[2], 10) - 543
          : now.getFullYear();
      const month =
        m && monthMap[m[1].toLowerCase()]
          ? monthMap[m[1].toLowerCase()]
          : now.getMonth() + 1;
      const kind: TxKind = file.name.includes("รายได้")
        ? "income"
        : "expense";
      const occurredAt = monthDate(year, month);
      rows = parsed.map((r) => ({
        source: file.name,
        occurredAt,
        kind,
        note: r.note,
        amount: r.amount,
      }));
    } else {
      return { ok: false, error: "รองรับเฉพาะ .zip และ .csv" };
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `แตกไฟล์ไม่สำเร็จ: ${err.message}`
          : "แตกไฟล์ไม่สำเร็จ",
    };
  }

  if (rows.length === 0) {
    return { ok: false, error: "ไม่พบรายการในไฟล์ — เช็คว่ามีข้อมูลใน CSV หรือยัง" };
  }

  const categories = await listCategories(ledgerId);
  let mappings;
  try {
    mappings = await mapNotesToCategories(
      rows.map((r) => ({ note: r.note, kind: r.kind })),
      categories
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AI map ไม่สำเร็จ",
    };
  }

  const monthAgg = new Map<string, { year: number; month: number; count: number; total: number }>();
  const previewRows: PreviewRow[] = rows.map((r, i) => {
    const sug = mappings.get(`${r.kind}:::${r.note}`) ?? {
      categoryId: null,
      newCategoryName: null,
      newCategoryIcon: null,
    };
    // Bucket by Bangkok month, not UTC. Without this, an import of a
    // single Bangkok-May ledger that contains rows at 02:00–07:00 Bangkok
    // would split the preview into "April" + "May" because those rows
    // land on April 30 in UTC.
    const { year, month } = yearMonthInTz(r.occurredAt, BUSINESS_TZ);
    const ym = `${year}-${month}`;
    const cur = monthAgg.get(ym) ?? { year, month, count: 0, total: 0 };
    cur.count += 1;
    cur.total += r.amount;
    monthAgg.set(ym, cur);

    return {
      id: `r${i}`,
      occurredAt: r.occurredAt,
      kind: r.kind,
      amount: r.amount,
      note: r.note,
      source: r.source,
      categoryId: sug.categoryId,
      newCategoryName: sug.newCategoryName,
      newCategoryIcon: sug.newCategoryIcon,
      paymentMethod: null, // Numbers app source has no payment-method column
      tripId: null,        // Numbers app source has no trip column
      tripName: null,
    };
  });

  return {
    ok: true,
    rows: previewRows,
    knownCategories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      kind: c.kind,
    })),
    monthSummary: Array.from(monthAgg.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    ),
  };
}

/**
 * Preview path for Jaitang's own CSV export. We never call the LLM here —
 * categories are matched by exact name (kind-aware). Misses are proposed as
 * new categories with the export's icon left blank, so the user can edit
 * before applying.
 */
async function previewJaitangCsv({
  ledgerId,
  text,
  sourceName,
}: {
  ledgerId: string;
  text: string;
  sourceName: string;
}): Promise<ImportPreview | { ok: false; error: string }> {
  const { rows: parsedRows, skipped } = parseJaitangCsv(text);
  if (parsedRows.length === 0) {
    return {
      ok: false,
      error:
        skipped > 0
          ? `อ่านไม่ออกทั้งไฟล์ — ข้าม ${skipped} แถว (วันที่/ประเภท/จำนวนหายหรือผิด format)`
          : "ไม่พบรายการในไฟล์",
    };
  }

  const [categories, destTrips] = await Promise.all([
    listCategories(ledgerId),
    listTrips(ledgerId, { includeArchived: true }),
  ]);
  // Build a lookup table keyed by `kind|name` so an "อาหาร" expense in the
  // source matches an "อาหาร" expense in the destination — but does NOT
  // match an income category that happens to share the name.
  const byKindName = new Map<string, Category>();
  for (const c of categories) {
    byKindName.set(`${c.kind}|${c.name}`, c);
  }
  // Trips don't have a kind, so a plain name → id map is enough. We
  // INCLUDE archived trips intentionally: re-importing into the same
  // ledger after archiving a trip should still re-link cleanly.
  const tripByName = new Map<string, string>();
  for (const tr of destTrips) {
    tripByName.set(tr.name, tr.id);
  }

  const monthAgg = new Map<
    string,
    { year: number; month: number; count: number; total: number }
  >();
  const previewRows: PreviewRow[] = parsedRows.map((r, i) => {
    const match = r.categoryName
      ? byKindName.get(`${r.kind}|${r.categoryName}`)
      : undefined;

    // Aggregate by Bangkok month — see comment in parseImportAction's
    // monthAgg loop for why UTC is wrong here.
    const { year, month } = yearMonthInTz(r.occurredAt, BUSINESS_TZ);
    const ym = `${year}-${month}`;
    const cur = monthAgg.get(ym) ?? { year, month, count: 0, total: 0 };
    cur.count += 1;
    cur.total += r.amount;
    monthAgg.set(ym, cur);

    const tripId = r.tripName ? tripByName.get(r.tripName) ?? null : null;

    return {
      id: `r${i}`,
      occurredAt: r.occurredAt,
      kind: r.kind,
      amount: r.amount,
      note: r.note,
      source: sourceName,
      categoryId: match?.id ?? null,
      newCategoryName: match ? null : r.categoryName,
      newCategoryIcon: match ? null : null, // user can edit icon in preview
      paymentMethod: r.paymentMethod,
      tripId,
      tripName: r.tripName,
    };
  });

  return {
    ok: true,
    rows: previewRows,
    knownCategories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      kind: c.kind,
    })),
    monthSummary: Array.from(monthAgg.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    ),
  };
}

const ApplyRow = z.object({
  occurredAt: z.string(),
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  // Note may be empty for Jaitang exports of uncategorized misc spends —
  // relax the lower bound from min(1) so those rows aren't silently dropped
  // by validation. The destination column is nullable.
  note: z.string().max(500),
  categoryId: z.string().uuid().nullable(),
  newCategoryName: z.string().min(1).max(50).nullable(),
  newCategoryIcon: z.string().min(1).max(8).nullable(),
  paymentMethod: z.enum(["cash", "transfer"]).nullable().optional(),
  tripId: z.string().uuid().nullable().optional(),
});

const ApplySchema = z.object({
  rows: z.array(ApplyRow).min(1).max(2000),
});

export async function applyImportAction(
  payload: unknown
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const { ledgerId, userId, role } = await requireSession();
  assertWritable(role);

  const parsed = ApplySchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid payload",
    };
  }

  // 1) materialize any newly-proposed categories first; cache the new ids by name
  const newCategoryCache = new Map<string, string>(); // `${kind}:${name}` → id
  for (const r of parsed.data.rows) {
    if (r.categoryId || !r.newCategoryName) continue;
    const cacheKey = `${r.kind}:${r.newCategoryName}`;
    if (newCategoryCache.has(cacheKey)) continue;
    const cat = await createCategory(ledgerId, {
      name: r.newCategoryName,
      icon: r.newCategoryIcon ?? "✨",
      kind: r.kind,
    });
    newCategoryCache.set(cacheKey, cat.id);
  }

  // Build a whitelist of trip ids that actually belong to THIS ledger.
  // We trust the preview to have already done the matching, but a stale
  // browser session or tampered payload could submit a uuid for a trip
  // in someone else's ledger. The FK alone wouldn't catch that — it
  // only enforces "trip exists somewhere".
  const allowedTripIds = new Set(
    (await listTrips(ledgerId, { includeArchived: true })).map((t) => t.id)
  );

  // 2) bulk insert transactions, resolving categoryId from cache where needed
  let created = 0;
  for (const r of parsed.data.rows) {
    let categoryId = r.categoryId;
    if (!categoryId && r.newCategoryName) {
      categoryId = newCategoryCache.get(`${r.kind}:${r.newCategoryName}`) ?? null;
    }
    const safeTripId =
      r.tripId && allowedTripIds.has(r.tripId) ? r.tripId : null;

    await createTransaction({
      ledgerId,
      userId,
      categoryId,
      tripId: safeTripId,
      kind: r.kind,
      amount: r.amount,
      note: r.note,
      paymentMethod: r.paymentMethod ?? null,
      occurredAt: r.occurredAt,
    });
    created++;
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  return { ok: true, created };
}
