"use client";

import { NewTransactionForm } from "@/components/new-transaction-form";
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
  const categories: Category[] = [
    "อาหาร:🍜",
    "คาเฟ่:☕",
    "ของหวาน:🍰",
    "เดินทาง:🚕",
    "ของใช้:🧴",
    "ไฟฟ้า:💡",
    "Bts:🚕",
  ].map((s, i) => {
    const [name, icon] = s.split(":");
    return {
      id: `c${i + 1}`,
      ledger_id: "demo",
      name,
      icon,
      color: null,
      kind: "expense" as const,
      sort_order: i + 1,
      parent_id: null,
    };
  });

  const accounts: AccountChoice[] = [
    { id: "a1", name: "yutuyt", icon: "💵", currency: "THB", archived: false },
  ];

  const activeTrip: TripChoice | null = null;

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/insights", label: "วิเคราะห์", icon: "insights" },
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
