import { requireSession } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";
import { resolveRange } from "@/lib/date-range";
import type { TxKind } from "@/lib/types";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const { ledgerId } = await requireSession();
  const url = new URL(req.url);
  const range = resolveRange(url.searchParams.get("range") ?? undefined);
  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam === "income" || kindParam === "expense" ? (kindParam as TxKind) : undefined;
  const categoryId = url.searchParams.get("category") || undefined;

  const items = await listTransactions({
    ledgerId,
    from: range.from,
    to: range.to,
    kind,
    categoryId,
    limit: 50000,
  });

  const header = ["วันที่", "ประเภท", "หมวด", "จำนวน", "ช่องทาง", "ทริป", "โน้ต"];
  const lines = [header.join(",")];
  for (const tx of items) {
    const method =
      tx.payment_method === "cash"
        ? "เงินสด"
        : tx.payment_method === "transfer"
        ? "เงินโอน"
        : "";
    lines.push(
      [
        new Date(tx.occurred_at).toISOString(),
        tx.kind === "income" ? "รายรับ" : "รายจ่าย",
        tx.category?.name ?? "ไม่ระบุ",
        tx.amount.toFixed(2),
        method,
        tx.trip?.name ?? "",
        tx.note ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  // Prepend BOM so Excel reads UTF-8 Thai correctly
  const csv = "﻿" + lines.join("\n");
  const filename = `jaitang-${range.key}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
