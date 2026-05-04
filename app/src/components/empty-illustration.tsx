type Kind =
  | "transactions"
  | "budget"
  | "goal"
  | "trip"
  | "account"
  | "recurring"
  | "chat"
  | "category";

/**
 * Themed SVG illustrations for empty states. Two-tone: a soft accent
 * fill (12% opacity) plus a 1.5px accent stroke. Picks up `--accent`
 * via `currentColor` (the wrapper sets `color: var(--accent)`), so
 * switching accent colors re-tints every empty state automatically.
 *
 * Sized at 96x96 by default; pass `size` to override.
 */
export function EmptyIllustration({
  kind,
  size = 96,
  className = "",
}: {
  kind: Kind;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ color: "var(--accent)" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {SHAPES[kind]}
      </svg>
    </div>
  );
}

const FILL = "currentColor";
const STROKE = "currentColor";

// Each shape is a fragment that uses currentColor for both fill (at 12%
// opacity) and stroke. Shapes stay in a 96×96 box with ~10px padding.
const SHAPES: Record<Kind, React.ReactNode> = {
  // Receipt with wavy bottom edge + 3 lines + a coin accent
  transactions: (
    <>
      <path
        d="M22 14h44a4 4 0 0 1 4 4v60l-8-5-8 5-8-5-8 5-8-5-8 5V18a4 4 0 0 1 4-4Z"
        fill={FILL}
        fillOpacity="0.12"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M30 30h32M30 40h24M30 50h20" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="62" cy="50" r="6" fill={FILL} fillOpacity="0.25" stroke={STROKE} strokeWidth="1.6" />
      <path d="M82 22l4 4M84 16l2 2M76 18l2 2" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // Piggy bank: body + ear + slot + coin floating in
  budget: (
    <>
      <path
        d="M14 50c0-13 11-22 26-22 8 0 15 3 19 8l8-3-3 9c2 3 3 6 3 10 0 4-1 7-3 10v8h-8l-3-4c-2 1-5 1-7 1l-3 4h-8l-2-5c-7-2-12-7-13-15H10l4-1Z"
        fill={FILL}
        fillOpacity="0.12"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="55" cy="44" r="2.5" fill={FILL} />
      <path d="M30 38h10" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="48" cy="20" r="5" fill={FILL} fillOpacity="0.25" stroke={STROKE} strokeWidth="1.6" />
      <path d="M48 17v6M45 20h6" stroke={STROKE} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  // Target with arrow
  goal: (
    <>
      <circle cx="48" cy="48" r="32" fill={FILL} fillOpacity="0.08" stroke={STROKE} strokeWidth="1.6" />
      <circle cx="48" cy="48" r="22" fill={FILL} fillOpacity="0.12" stroke={STROKE} strokeWidth="1.6" />
      <circle cx="48" cy="48" r="12" fill={FILL} fillOpacity="0.2" stroke={STROKE} strokeWidth="1.6" />
      <circle cx="48" cy="48" r="3" fill={FILL} />
      <path d="M70 26L52 44M52 44h6M52 44v6" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Paper plane
  trip: (
    <>
      <path
        d="M82 14L14 40l24 8 6 24 12-16 22 14L82 14Z"
        fill={FILL}
        fillOpacity="0.12"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M82 14L38 48" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M44 60l8-6" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20" cy="74" r="2" fill={FILL} />
      <circle cx="76" cy="74" r="1.5" fill={FILL} />
    </>
  ),
  // Stacked wallets
  account: (
    <>
      <rect x="14" y="32" width="68" height="46" rx="6" fill={FILL} fillOpacity="0.12" stroke={STROKE} strokeWidth="1.6" />
      <path d="M14 44h68" stroke={STROKE} strokeWidth="1.6" />
      <circle cx="68" cy="60" r="4" fill={FILL} fillOpacity="0.4" stroke={STROKE} strokeWidth="1.4" />
      <rect x="22" y="20" width="52" height="10" rx="3" fill={FILL} fillOpacity="0.18" stroke={STROKE} strokeWidth="1.4" />
      <rect x="30" y="12" width="36" height="6" rx="2" fill={FILL} fillOpacity="0.22" stroke={STROKE} strokeWidth="1.4" />
    </>
  ),
  // Calendar with circular arrow
  recurring: (
    <>
      <rect x="16" y="20" width="52" height="50" rx="5" fill={FILL} fillOpacity="0.1" stroke={STROKE} strokeWidth="1.6" />
      <path d="M16 32h52" stroke={STROKE} strokeWidth="1.6" />
      <path d="M26 14v10M58 14v10" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="34" cy="46" r="2" fill={FILL} />
      <circle cx="42" cy="46" r="2" fill={FILL} fillOpacity="0.5" />
      <path
        d="M64 60a14 14 0 1 1-4-12l4-3v8h-8"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // Two speech bubbles
  chat: (
    <>
      <path
        d="M12 22a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6H32l-12 10v-10h-2a6 6 0 0 1-6-6V22Z"
        fill={FILL}
        fillOpacity="0.12"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="33" r="2" fill={FILL} />
      <circle cx="36" cy="33" r="2" fill={FILL} />
      <circle cx="48" cy="33" r="2" fill={FILL} />
      <path
        d="M84 42a6 6 0 0 0-6-6H58v22a6 6 0 0 0 6 6h6l8 8v-8h2a6 6 0 0 0 6-6V42Z"
        fill={FILL}
        fillOpacity="0.18"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  ),
  // Folder tree
  category: (
    <>
      <path
        d="M14 24a4 4 0 0 1 4-4h14l6 6h40a4 4 0 0 1 4 4v36a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V24Z"
        fill={FILL}
        fillOpacity="0.12"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M28 44h40M28 54h28" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="22" cy="44" r="2" fill={FILL} />
      <circle cx="22" cy="54" r="2" fill={FILL} fillOpacity="0.5" />
    </>
  ),
};
