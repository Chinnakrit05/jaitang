/**
 * Public preview of the navigation chrome that lives behind the auth gate.
 * Lets reviewers see the new Sticker Pop nav icons without signing in.
 * Safe to delete once the feat/custom-icons PR is merged.
 */
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { MobileNav, type NavItem } from "@/components/mobile-nav";
import { JtIcon, EmojiOrIcon, type IconName } from "@/components/icons";

const ACCOUNT_PALETTE: IconName[] = [
  "cash-stack",
  "piggy-bank",
  "credit-card",
  "phone-wallet",
  "money-bag",
  "coin-purse",
  "atm",
  "gold-coin",
];

const TRIP_PALETTE: IconName[] = [
  "airplane",
  "beach",
  "mountain",
  "ramen",
  "party",
  "backpack",
  "car",
  "cruise-ship",
  "camping",
  "gift",
];

const GOAL_PALETTE: IconName[] = [
  "bullseye",
  "airplane",
  "beach",
  "house",
  "car",
  "ring",
  "graduation-cap",
  "laptop",
  "game-controller",
  "shopping-cart",
];

const CATEGORY_PALETTE: IconName[] = [
  "ramen",
  "coffee",
  "car",
  "shopping-cart",
  "game-controller",
  "pill",
  "house",
  "books",
  "airplane",
  "gift",
  "money-bag",
  "trending-up",
  "tag",
  "sparkle",
];

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/quick", label: "Quick add", icon: "quick" },
  { href: "/transactions", label: "Transactions", icon: "transactions" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/chat", label: "Ask AI", icon: "chat" },
  { href: "/budgets", label: "Budgets", icon: "budgets" },
  { href: "/recurring", label: "Recurring", icon: "recurring" },
  { href: "/balances", label: "Balances", icon: "balances" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
  { href: "/loans", label: "Loans", icon: "loans" },
  { href: "/trips", label: "Trips", icon: "trips" },
  { href: "/goals", label: "Goals", icon: "goals" },
  { href: "/categories", label: "Categories", icon: "categories" },
  { href: "/ledgers", label: "Ledgers", icon: "ledgers" },
  { href: "/import", label: "Import", icon: "import" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const MOBILE_PRIMARY: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/quick", label: "Quick", icon: "quick" },
  { href: "/transactions", label: "Tx", icon: "transactions" },
  { href: "/ledgers", label: "Books", icon: "ledgers" },
];

export default function MenuPreviewPage() {
  return (
    <div className="min-h-screen flex">
      <DesktopSidebar items={NAV} />

      <main className="flex-1 p-8 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">Navigation preview</h1>
          <p className="text-sm text-(--muted) mt-1">
            Public preview of <code>DesktopSidebar</code> (left) +{" "}
            <code>MobileNav</code> (below). Real Sticker Pop icons via{" "}
            <code>&lt;JtIcon&gt;</code>.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-(--muted) uppercase tracking-wider">
            Action button samples
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl bg-(--accent) px-4 py-2 text-sm font-semibold text-(--accent-foreground)">
              <JtIcon name="plus-fab" size={16} /> New transaction
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) px-4 py-2 text-sm font-medium">
              <JtIcon name="pencil" size={14} /> Edit
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) px-4 py-2 text-sm font-medium text-(--expense)">
              <JtIcon name="trash2" size={14} /> Delete
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) px-4 py-2 text-sm font-medium">
              <JtIcon name="download" size={14} /> Export
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) px-4 py-2 text-sm font-medium">
              <JtIcon name="camera" size={14} /> Scan
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) px-4 py-2 text-sm font-medium">
              <JtIcon name="share" size={14} /> Share
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-(--muted) uppercase tracking-wider">
            Status row
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-(--income)">
              <JtIcon name="trending-up" size={16} /> +12,400
            </span>
            <span className="inline-flex items-center gap-1.5 text-(--expense)">
              <JtIcon name="trending-down" size={16} /> -8,650
            </span>
            <span className="inline-flex items-center gap-1.5 text-(--muted)">
              <JtIcon name="minus" size={16} /> 0
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-500">
              <JtIcon name="flame" size={16} /> Hot day
            </span>
            <span className="inline-flex items-center gap-1.5 text-(--accent)">
              <JtIcon name="sparkles" size={16} /> AI insight
            </span>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-(--muted) uppercase tracking-wider">
            Account-type chips
          </h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["banknote", "Cash"],
                ["landmark", "Bank"],
                ["credit-card", "Credit"],
                ["smartphone", "E-wallet"],
              ] as const
            ).map(([icon, label]) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-(--border) bg-(--card) px-3 py-1.5 text-xs font-medium"
              >
                <JtIcon name={icon} size={16} /> {label}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-4 pt-8">
          <h2 className="text-sm font-medium text-(--muted) uppercase tracking-wider">
            Phase 4 — Emoji palettes (pickers + display)
          </h2>

          <PalettePreview label="Account picker (8)" palette={ACCOUNT_PALETTE} />
          <PalettePreview label="Trip picker (10)" palette={TRIP_PALETTE} />
          <PalettePreview label="Goal picker (10)" palette={GOAL_PALETTE} />
          <PalettePreview label="Category picker (14)" palette={CATEGORY_PALETTE} />

          <div className="text-xs text-(--muted) pt-2">
            Legacy emoji values (e.g. <EmojiOrIcon value="💵" size={14} />,{" "}
            <EmojiOrIcon value="✈️" size={14} />,{" "}
            <EmojiOrIcon value="🎯" size={14} />) still render via{" "}
            <code>EmojiOrIcon</code> for old DB rows.
          </div>
        </section>

        <section className="space-y-3 pt-12">
          <h2 className="text-sm font-medium text-(--muted) uppercase tracking-wider">
            Mobile bottom nav (preview only — fixed bar lives at viewport bottom on mobile)
          </h2>
          <div className="rounded-xl border border-(--border) bg-(--card)/40 overflow-hidden">
            <MobileNav primary={MOBILE_PRIMARY} all={NAV} moreLabel="More" />
          </div>
        </section>
      </main>
    </div>
  );
}

function PalettePreview({
  label,
  palette,
}: {
  label: string;
  palette: IconName[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-(--muted) font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {palette.map((name) => (
          <span
            key={name}
            className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-(--border) bg-(--card)"
          >
            <JtIcon name={name} size={24} />
          </span>
        ))}
      </div>
    </div>
  );
}
