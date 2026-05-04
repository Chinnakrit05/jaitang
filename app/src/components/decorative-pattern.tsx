/**
 * Decorative SVG ornaments — absolutely positioned background art for
 * hero sections (dashboard greeting, login card, etc.). Tinted with
 * the active `--accent` color so changing the accent re-tints them.
 *
 * `kind="dots"`     — soft dot grid that fades toward the corner
 * `kind="waves"`    — three layered wave lines
 * `kind="confetti"` — scattered geometric shapes (sparkles + arcs)
 */
type Kind = "dots" | "waves" | "confetti";

export function DecorativePattern({
  kind,
  className = "",
}: {
  kind: Kind;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{ color: "var(--accent)" }}
    >
      {kind === "dots" && <DotGrid />}
      {kind === "waves" && <Waves />}
      {kind === "confetti" && <Confetti />}
    </div>
  );
}

function DotGrid() {
  // 8x8 grid of dots with radial-fade opacity. Computed once at module
  // scope so React never re-renders the dot array on theme change.
  const dots: Array<[number, number, number]> = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cx = 8 + c * 14;
      const cy = 8 + r * 14;
      // Fade based on distance from top-right corner (where the pattern
      // visually anchors). Closer = more opaque.
      const dx = (7 - c) / 7;
      const dy = r / 7;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const opacity = Math.max(0, 0.55 - dist * 0.55);
      dots.push([cx, cy, opacity]);
    }
  }
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {dots.map(([cx, cy, op], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.5" fill="currentColor" opacity={op} />
      ))}
    </svg>
  );
}

function Waves() {
  return (
    <svg width="280" height="120" viewBox="0 0 280 120" fill="none">
      <path
        d="M0 60 Q70 30 140 60 T280 60"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M0 80 Q70 50 140 80 T280 80"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.22"
      />
      <path
        d="M0 100 Q70 70 140 100 T280 100"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.12"
      />
    </svg>
  );
}

function Confetti() {
  return (
    <svg width="200" height="160" viewBox="0 0 200 160" fill="none">
      {/* Sparkles */}
      <path d="M30 30l3-7 3 7 7 3-7 3-3 7-3-7-7-3z" fill="currentColor" opacity="0.5" />
      <path d="M160 70l2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="currentColor" opacity="0.7" />
      <path d="M120 20l1.5-3 1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5z" fill="currentColor" opacity="0.4" />
      {/* Tiny circles */}
      <circle cx="80" cy="50" r="2.5" fill="currentColor" opacity="0.45" />
      <circle cx="180" cy="120" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="50" cy="120" r="2" fill="currentColor" opacity="0.5" />
      {/* Arcs */}
      <path
        d="M100 100 Q120 80 140 100"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        d="M20 80 Q35 65 50 80"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}
