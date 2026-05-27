"use client";

import { NewTransactionForm } from "@/components/new-transaction-form";
import { ReceiptUploader } from "@/components/receipt-uploader";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import type {
  AccountChoice,
  TripChoice,
} from "@/components/transaction-form";
import type { Category } from "@/lib/types";

/**
 * Public preview for the redesigned `/transactions/new` page. Mirrors
 * the pattern used by `/tx-preview` — outside the `(app)` auth group so
 * designers can iterate without a Supabase session. Wires fixture
 * categories + accounts through the real `NewTransactionForm` so the
 * preview stays in sync with what users actually see when logged in.
 */
export default function NewTransactionPreviewPage() {
  // [name, icon, parent_id (or null)] — first two are top-level, rest
  // are subs of อาหาร / เดินทาง so the parent-badge shows in the grid.
  const raw: Array<[string, string, string | null]> = [
    ["อาหาร", "🍜", null],
    ["เดินทาง", "🚕", null],
    ["คาเฟ่", "☕", "c1"],
    ["ของหวาน", "🍰", "c1"],
    ["น้ำมัน", "⛽", "c2"],
    ["ขนส่งสาธารณะ", "🚇", "c2"],
    ["Bts", "🚕", "c2"],
  ];
  const categories: Category[] = raw.map(([name, icon, parent_id], i) => ({
    id: `c${i + 1}`,
    ledger_id: "demo",
    name,
    icon,
    color: null,
    kind: "expense" as const,
    sort_order: i + 1,
    parent_id,
  }));

  const accounts: AccountChoice[] = [
    { id: "a1", name: "yutuyt", icon: "💵", currency: "THB", archived: false },
  ];

  const activeTrip: TripChoice | null = null;

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/reports", label: "รายงาน", icon: "insights" },
  ];

  async function noopAction() {
    // Preview-only — surface a friendly inline error instead of mutating data.
    return { ok: false as const, error: "Preview mode — บันทึกจริงต้อง login ก่อน" };
  }

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md mx-auto px-4 pt-6">
        <NewTransactionForm
          categories={categories}
          accounts={accounts}
          activeTrip={activeTrip}
          currency="THB"
          action={noopAction}
          headerAction={
            <ReceiptUploader
              variant="compact"
              onParsed={() => {
                /* preview: ignore OCR result */
              }}
            />
          }
        />
      </div>
      <MobileNav
        primary={navPrimary}
        all={navPrimary}
        moreLabel="เพิ่มเติม"
        fabLabel="เพิ่มรายการ"
      />
    </div>
  );
}
