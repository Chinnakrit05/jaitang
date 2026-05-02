/**
 * Tests for the Jaitang-format CSV parser. Tightly coupled to what
 * `transactions/export/route.ts` emits — if the export format changes,
 * one of these will fail loudly, which is the point.
 */
import { describe, expect, it } from "vitest";
import { isJaitangCsv, parseJaitangCsv } from "./jaitang-csv";

const HEADER = "วันที่,ประเภท,หมวด,จำนวน,ช่องทาง,ทริป,โน้ต";
const LEGACY_HEADER = "วันที่,ประเภท,หมวด,จำนวน,ช่องทาง,โน้ต";
const BOM = "﻿";

function build(lines: string[]): string {
  return BOM + [HEADER, ...lines].join("\n");
}
function buildLegacy(lines: string[]): string {
  return BOM + [LEGACY_HEADER, ...lines].join("\n");
}

describe("isJaitangCsv", () => {
  it("recognizes a freshly-exported file (with BOM)", () => {
    const csv = build(["2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,เงินสด,,กาแฟ"]);
    expect(isJaitangCsv(csv)).toBe(true);
  });

  it("recognizes a header without BOM", () => {
    const csv = HEADER + "\n2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,เงินสด,,กาแฟ";
    expect(isJaitangCsv(csv)).toBe(true);
  });

  it("recognizes older exports that lacked the ช่องทาง / ทริป columns", () => {
    // Pre-payment-method export — first 4 columns must still match.
    const csv = "วันที่,ประเภท,หมวด,จำนวน,โน้ต\n2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,กาแฟ";
    expect(isJaitangCsv(csv)).toBe(true);
  });

  it("rejects Numbers-app CSV", () => {
    expect(isJaitangCsv("กาแฟ,฿65\nค่าเช่า,฿4000")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isJaitangCsv("")).toBe(false);
    expect(isJaitangCsv("\n\n")).toBe(false);
  });
});

describe("parseJaitangCsv", () => {
  it("parses a single typical row (new 7-col format with trip)", () => {
    const csv = build([
      "2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,เงินสด,ทริปทะเล,กาแฟ",
    ]);
    const { rows, skipped } = parseJaitangCsv(csv);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      occurredAt: "2026-05-02T03:30:00.000Z",
      kind: "expense",
      categoryName: "อาหาร",
      amount: 100,
      paymentMethod: "cash",
      tripName: "ทริปทะเล",
      fxCurrency: null,
      fxAmount: null,
      fxRate: null,
      note: "กาแฟ",
    });
  });

  it("treats blank trip column as null", () => {
    const csv = build([
      "2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,เงินสด,,กาแฟ",
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].tripName).toBeNull();
  });

  it("parses a legacy 6-col export and leaves tripName null", () => {
    const csv = buildLegacy([
      "2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,เงินสด,กาแฟ",
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0]).toEqual({
      occurredAt: "2026-05-02T03:30:00.000Z",
      kind: "expense",
      categoryName: "อาหาร",
      amount: 100,
      paymentMethod: "cash",
      tripName: null,
      fxCurrency: null,
      fxAmount: null,
      fxRate: null,
      note: "กาแฟ",
    });
  });

  it("handles income, transfer, and quoted notes", () => {
    const csv = build([
      `2026-05-01T01:00:00.000Z,รายรับ,เงินเดือน,30000.00,เงินโอน,,"เดือน พ.ค."`,
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].kind).toBe("income");
    expect(rows[0].paymentMethod).toBe("transfer");
    expect(rows[0].note).toBe("เดือน พ.ค.");
  });

  it("treats 'ไม่ระบุ' category as null (not a real category to recreate)", () => {
    const csv = build([
      "2026-05-02T03:30:00.000Z,รายจ่าย,ไม่ระบุ,50.00,เงินสด,,ค่ารถ",
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].categoryName).toBeNull();
  });

  it("treats empty payment-method column as null", () => {
    const csv = build([
      "2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,,,กาแฟ",
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].paymentMethod).toBeNull();
  });

  it("preserves notes that contain commas (RFC-4180 quoted)", () => {
    const csv = build([
      `2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,150.00,เงินสด,,"ข้าวมันไก่, ชาเย็น"`,
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].note).toBe("ข้าวมันไก่, ชาเย็น");
  });

  it("preserves notes with embedded double-quotes (escaped as \"\")", () => {
    const csv = build([
      `2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,150.00,เงินสด,,"แท้ ""organic"""`,
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].note).toBe(`แท้ "organic"`);
  });

  it("skips rows with missing essential fields and reports the count", () => {
    const csv = build([
      "2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,100.00,เงินสด,,กาแฟ",
      ",,,,,,",                          // entirely blank
      "not-a-date,รายจ่าย,อาหาร,99,เงินสด,,หาย",     // bad date
      "2026-05-02T03:30:00.000Z,???,อาหาร,99,เงินสด,,kind", // bad kind
      "2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,0,เงินสด,,zero", // amount must be positive
    ]);
    const { rows, skipped } = parseJaitangCsv(csv);
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(4);
  });

  it("normalises ISO dates with explicit offset to a UTC ISO instant", () => {
    const csv = build([
      // 10:30 +07:00 = 03:30 UTC
      "2026-05-02T10:30:00+07:00,รายจ่าย,อาหาร,100.00,เงินสด,,brunch",
    ]);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].occurredAt).toBe("2026-05-02T03:30:00.000Z");
  });

  it("returns empty list for header-only file (nothing to import, but not an error)", () => {
    const csv = build([]);
    const { rows, skipped } = parseJaitangCsv(csv);
    expect(rows).toHaveLength(0);
    expect(skipped).toBe(0);
  });
});

describe("export → parse round trip", () => {
  // Mimic exactly what `export/route.ts` writes, including the BOM, so we
  // catch silent format drift between the two halves of the round-trip.
  function csvEscape(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function exportLine(tx: {
    occurredAt: string;
    kind: "income" | "expense";
    category: string | null;
    amount: number;
    paymentMethod: "cash" | "transfer" | null;
    tripName: string | null;
    note: string | null;
  }): string {
    const method =
      tx.paymentMethod === "cash"
        ? "เงินสด"
        : tx.paymentMethod === "transfer"
        ? "เงินโอน"
        : "";
    return [
      new Date(tx.occurredAt).toISOString(),
      tx.kind === "income" ? "รายรับ" : "รายจ่าย",
      tx.category ?? "ไม่ระบุ",
      tx.amount.toFixed(2),
      method,
      tx.tripName ?? "",
      tx.note ?? "",
    ]
      .map(csvEscape)
      .join(",");
  }

  it("a full row survives export → parse without loss", () => {
    const original = {
      occurredAt: "2026-05-02T03:30:00.000Z",
      kind: "expense" as const,
      category: "อาหาร",
      amount: 123.45,
      paymentMethod: "cash" as const,
      tripName: "ทริปทะเล",
      note: 'lunch, with "x"',
    };
    const csv = BOM + [HEADER, exportLine(original)].join("\n");
    expect(isJaitangCsv(csv)).toBe(true);
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0]).toEqual({
      occurredAt: original.occurredAt,
      kind: original.kind,
      categoryName: "อาหาร",
      amount: 123.45,
      paymentMethod: "cash",
      tripName: "ทริปทะเล",
      fxCurrency: null,
      fxAmount: null,
      fxRate: null,
      note: 'lunch, with "x"',
    });
  });

  it("a row with no trip in source still parses with tripName=null", () => {
    const csv = BOM + [
      HEADER,
      exportLine({
        occurredAt: "2026-05-02T03:30:00.000Z",
        kind: "expense",
        category: "อาหาร",
        amount: 50,
        paymentMethod: "cash",
        tripName: null,
        note: "lunch",
      }),
    ].join("\n");
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].tripName).toBeNull();
  });

  it("round-trips FX columns when present", () => {
    // Header includes ทั้ง 3 FX columns + values are valid → parser keeps them.
    const fxHeader =
      "วันที่,ประเภท,หมวด,จำนวน,ช่องทาง,ทริป,สกุลต่างประเทศ,จำนวนต่างประเทศ,อัตรา,โน้ต";
    const csv =
      BOM +
      [
        fxHeader,
        // 350 THB ≈ 1500 JPY at 0.2333 rate
        `2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,350.00,เงินสด,ทริปญี่ปุ่น,JPY,1500.00,0.2333,ราเมง`,
      ].join("\n");
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0]).toMatchObject({
      occurredAt: "2026-05-02T03:30:00.000Z",
      kind: "expense",
      categoryName: "อาหาร",
      amount: 350,
      paymentMethod: "cash",
      tripName: "ทริปญี่ปุ่น",
      fxCurrency: "JPY",
      fxAmount: 1500,
      fxRate: 0.2333,
      note: "ราเมง",
    });
  });

  it("drops partial FX (e.g. amount missing) back to home-currency row", () => {
    const fxHeader =
      "วันที่,ประเภท,หมวด,จำนวน,ช่องทาง,ทริป,สกุลต่างประเทศ,จำนวนต่างประเทศ,อัตรา,โน้ต";
    const csv =
      BOM +
      [
        fxHeader,
        // fx_amount missing — DB constraint requires all-or-none, so we
        // refuse to parse a partial set.
        `2026-05-02T03:30:00.000Z,รายจ่าย,อาหาร,350.00,เงินสด,,JPY,,0.2333,ราเมง`,
      ].join("\n");
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].fxCurrency).toBeNull();
    expect(rows[0].fxAmount).toBeNull();
    expect(rows[0].fxRate).toBeNull();
  });

  it("preserves trip names that contain commas (RFC-4180 quoted)", () => {
    const csv = BOM + [
      HEADER,
      exportLine({
        occurredAt: "2026-05-02T03:30:00.000Z",
        kind: "expense",
        category: "อาหาร",
        amount: 100,
        paymentMethod: "cash",
        tripName: "Trip, with comma",
        note: "test",
      }),
    ].join("\n");
    const { rows } = parseJaitangCsv(csv);
    expect(rows[0].tripName).toBe("Trip, with comma");
  });
});

describe("import — destination-side trip matching simulation", () => {
  // Simulates the matching step inside `previewJaitangCsv` without
  // reaching for Supabase. The logic under test: take parsed rows with
  // `tripName`, build a `Map<name → id>` from destination trips, link
  // matches, leave unmatched names null but preserved for the wizard.
  type ParsedRow = { tripName: string | null };
  type DestTrip = { id: string; name: string };

  function matchTrips(rows: ParsedRow[], destTrips: DestTrip[]) {
    const byName = new Map<string, string>();
    for (const t of destTrips) byName.set(t.name, t.id);
    return rows.map((r) => ({
      tripName: r.tripName,
      tripId: r.tripName ? byName.get(r.tripName) ?? null : null,
    }));
  }

  it("matches by exact name and leaves unknown trip names as null tripId", () => {
    const result = matchTrips(
      [
        { tripName: "ทริปทะเล" },
        { tripName: "ทริปภูเขา" }, // not in destination
        { tripName: null },
      ],
      [{ id: "trip-uuid-1", name: "ทริปทะเล" }]
    );
    expect(result[0].tripId).toBe("trip-uuid-1");
    expect(result[1].tripId).toBeNull();
    expect(result[1].tripName).toBe("ทริปภูเขา");
    expect(result[2].tripId).toBeNull();
    expect(result[2].tripName).toBeNull();
  });

  it("doesn't link by trim/case — name match must be exact", () => {
    const result = matchTrips(
      [
        { tripName: " ทริปทะเล" }, // leading space
        { tripName: "ทริปทะเล " }, // trailing space
        { tripName: "TRIP" }, // case
      ],
      [
        { id: "1", name: "ทริปทะเล" },
        { id: "2", name: "trip" },
      ]
    );
    expect(result.every((r) => r.tripId === null)).toBe(true);
  });

  it("preserves the destination-trip id even if multiple source rows share the name", () => {
    const result = matchTrips(
      [
        { tripName: "ทริปทะเล" },
        { tripName: "ทริปทะเล" },
        { tripName: "ทริปทะเล" },
      ],
      [{ id: "trip-1", name: "ทริปทะเล" }]
    );
    expect(result.map((r) => r.tripId)).toEqual(["trip-1", "trip-1", "trip-1"]);
  });
});
