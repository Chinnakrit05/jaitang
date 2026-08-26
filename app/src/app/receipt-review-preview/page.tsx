"use client";

import { useState } from "react";
import { ReceiptItemsReview } from "@/components/receipt-items-review";
import type { Category } from "@/lib/types";
import type { ParsedReceiptItems } from "@/lib/receipt-items";

/**
 * Public preview for the receipt-splitting review sheet. Same pattern
 * as `/new-tx-preview` — outside the `(app)` auth group so the sheet
 * can be looked at without a Supabase session, wired through the real
 * component so it stays honest.
 *
 * Saving is not exercised here: the action behind it needs a session.
 */
const CATEGORY_FIXTURES: Array<[string, string]> = [
  ["อาหาร", "🍜"],
  ["ของใช้ในบ้าน", "🧻"],
  ["สัตว์เลี้ยง", "🐈"],
  ["ของหวาน", "🍰"],
];

const categories: Category[] = CATEGORY_FIXTURES.map(([name, icon], i) => ({
  id: `c${i + 1}`,
  ledger_id: "demo",
  name,
  icon,
  color: null,
  kind: "expense" as const,
  sort_order: i + 1,
  parent_id: null,
}));

const parsed: ParsedReceiptItems = {
  merchant: "Tops Market",
  occurredAt: "2026-08-26T18:42:00",
  kind: "expense",
  paymentMethod: "cash",
  total: 1442,
  confidence: "high",
  items: [
    { name: "นมสด 2 ลิตร", amount: 119, categoryId: "c1" },
    { name: "ไข่ไก่ เบอร์ 2", amount: 89, categoryId: "c1" },
    { name: "อาหารแมว ซาลมอน", amount: 545, categoryId: "c3" },
    { name: "ทรายแมว 10L", amount: 320, categoryId: "c3" },
    { name: "น้ำยาล้างจาน", amount: 79, categoryId: "c2" },
    { name: "ถุงขยะ", amount: 45, categoryId: "c2" },
    { name: "เค้กช็อกโกแลต", amount: 145, categoryId: null },
  ],
};

export default function ReceiptReviewPreviewPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen p-6 soft-page">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-[16px] soft-raised text-sm font-medium"
      >
        เปิดหน้าต่างรีวิวใบเสร็จ
      </button>
      {open && (
        <ReceiptItemsReview
          parsed={parsed}
          categories={categories}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
