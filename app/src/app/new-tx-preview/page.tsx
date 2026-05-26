import { NewTxMockup } from "./mockup";
import { MobileNav, type NavItem } from "@/components/mobile-nav";

/**
 * Public preview for the redesigned `/transactions/new` page. Mirrors
 * the pattern used by `/tx-preview` — outside the `(app)` auth group so
 * designers can iterate without a Supabase session. Feeds fixture
 * categories/accounts matching the Figma mockup so visual diffs are
 * easy.
 */
export default function NewTransactionPreviewPage() {
  const categories = [
    { id: "c1", name: "อาหาร", icon: "🍜" },
    { id: "c2", name: "คาเฟ่", icon: "☕" },
    { id: "c3", name: "ของหวาน", icon: "🍰" },
    { id: "c4", name: "เดินทาง", icon: "🚕" },
    { id: "c5", name: "ของใช้", icon: "🧴" },
    { id: "c6", name: "ไฟฟ้า", icon: "💡" },
    { id: "c7", name: "Bts", icon: "🚕" },
  ];

  const accounts = [
    { id: "a1", name: "yutuyt", icon: "💵" },
  ];

  const navPrimary: NavItem[] = [
    { href: "/dashboard", label: "หลัก", icon: "home" },
    { href: "/transactions", label: "รายการ", icon: "transactions" },
    { href: "/insights", label: "วิเคราะห์", icon: "insights" },
  ];

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-md mx-auto px-4 pt-6">
        <NewTxMockup categories={categories} accounts={accounts} />
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
