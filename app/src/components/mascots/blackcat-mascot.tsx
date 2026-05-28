/**
 * Black cat mascot — น้องแมวดำ. Simpler than the Shiba (head only,
 * no chest fluff) but built in the same layered SVG style so the
 * head + ears + eyes read as one shape rather than a flat icon.
 */
export function BlackCatMascot({
  size = 94,
  idPrefix = "blackcat",
}: {
  size?: number;
  idPrefix?: string;
}) {
  const id = (key: string) => `${idPrefix}-${key}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={id("fur")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A2A4F" />
          <stop offset="0.55" stopColor="#1F142C" />
          <stop offset="1" stopColor="#0F0A18" />
        </linearGradient>
        <linearGradient id={id("ear")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0A6B8" />
          <stop offset="1" stopColor="#C97188" />
        </linearGradient>
        <radialGradient id={id("eye")} cx="0.4" cy="0.35" r="0.85">
          <stop offset="0" stopColor="#A0E26A" />
          <stop offset="1" stopColor="#3A7A22" />
        </radialGradient>
      </defs>

      {/* Floor shadow */}
      <ellipse cx={60} cy={108} rx={26} ry={3.4} fill="rgba(20,10,30,0.22)" />

      {/* Ears (outer fur) */}
      <path
        d="M30 50 Q24 22 30 20 Q40 24 48 42 Z"
        fill={`url(#${id("fur")})`}
      />
      <path
        d="M90 50 Q96 22 90 20 Q80 24 72 42 Z"
        fill={`url(#${id("fur")})`}
      />
      {/* Inner ears (pink) */}
      <path d="M33 44 Q30 27 33 26 Q39 31 45 42 Z" fill={`url(#${id("ear")})`} />
      <path d="M87 44 Q90 27 87 26 Q81 31 75 42 Z" fill={`url(#${id("ear")})`} />

      {/* Head */}
      <ellipse
        cx={60}
        cy={66}
        rx={32}
        ry={28}
        fill={`url(#${id("fur")})`}
      />
      {/* Subtle top highlight */}
      <ellipse cx={52} cy={50} rx={14} ry={6} fill="#FFFFFF" opacity={0.08} />

      {/* Eyes — almond with vertical slit pupil */}
      <path
        d="M40 60 Q48 52 56 60 Q48 67 40 60 Z"
        fill={`url(#${id("eye")})`}
      />
      <path
        d="M64 60 Q72 52 80 60 Q72 67 64 60 Z"
        fill={`url(#${id("eye")})`}
      />
      {/* Pupils */}
      <ellipse cx={48} cy={60} rx={1.4} ry={4.5} fill="#0A0F05" />
      <ellipse cx={72} cy={60} rx={1.4} ry={4.5} fill="#0A0F05" />
      {/* Eye specular highlights */}
      <circle cx={46} cy={58} r={1.1} fill="#FFFFFF" />
      <circle cx={70} cy={58} r={1.1} fill="#FFFFFF" />

      {/* Nose */}
      <path
        d="M56 72 Q60 69 64 72 Q62 76 60 76 Q58 76 56 72 Z"
        fill="#F0A6B8"
      />

      {/* Mouth — cat smile */}
      <path
        d="M52 80 Q56 84 60 80 Q64 84 68 80"
        stroke="#0A0610"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Whiskers (very subtle) */}
      <path d="M30 70 L42 71" stroke="#FFFFFF" strokeWidth={0.6} opacity={0.4} strokeLinecap="round" />
      <path d="M30 74 L42 74" stroke="#FFFFFF" strokeWidth={0.6} opacity={0.4} strokeLinecap="round" />
      <path d="M78 71 L90 70" stroke="#FFFFFF" strokeWidth={0.6} opacity={0.4} strokeLinecap="round" />
      <path d="M78 74 L90 74" stroke="#FFFFFF" strokeWidth={0.6} opacity={0.4} strokeLinecap="round" />

      {/* Sparkle */}
      <g opacity={0.85}>
        <path
          d="M92 30 L93.2 33 L96 34.2 L93.2 35.4 L92 38.4 L90.8 35.4 L88 34.2 L90.8 33 Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}
