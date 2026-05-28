/**
 * White cat mascot — น้องแมวขาว. Soft white head with pink-inner
 * pointy ears, aqua almond eyes, pink nose + cheeks.
 */
export function WhiteCatMascot({
  size = 94,
  idPrefix = "whitecat",
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
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#F5EDED" />
          <stop offset="1" stopColor="#E0D4D4" />
        </linearGradient>
        <linearGradient id={id("ear")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBC9D6" />
          <stop offset="1" stopColor="#E89AAE" />
        </linearGradient>
        <radialGradient id={id("eye")} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#7BD3E0" />
          <stop offset="1" stopColor="#2D7A92" />
        </radialGradient>
        <radialGradient id={id("blush")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F58FA8" stopOpacity="0.7" />
          <stop offset="1" stopColor="#F58FA8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={108} rx={26} ry={3.4} fill="rgba(100,60,80,0.18)" />

      {/* Outer ears (light fur) */}
      <path
        d="M30 50 Q24 22 30 20 Q40 24 48 42 Z"
        fill={`url(#${id("fur")})`}
        stroke="#D0BFBF"
        strokeWidth={0.7}
      />
      <path
        d="M90 50 Q96 22 90 20 Q80 24 72 42 Z"
        fill={`url(#${id("fur")})`}
        stroke="#D0BFBF"
        strokeWidth={0.7}
      />
      {/* Inner ears pink */}
      <path d="M33 44 Q30 27 33 26 Q39 31 45 42 Z" fill={`url(#${id("ear")})`} />
      <path d="M87 44 Q90 27 87 26 Q81 31 75 42 Z" fill={`url(#${id("ear")})`} />

      {/* Head */}
      <ellipse
        cx={60}
        cy={66}
        rx={32}
        ry={28}
        fill={`url(#${id("fur")})`}
        stroke="#D0BFBF"
        strokeWidth={0.6}
      />

      {/* Eyes — aqua almond */}
      <path
        d="M40 60 Q48 52 56 60 Q48 67 40 60 Z"
        fill={`url(#${id("eye")})`}
      />
      <path
        d="M64 60 Q72 52 80 60 Q72 67 64 60 Z"
        fill={`url(#${id("eye")})`}
      />
      <ellipse cx={48} cy={60} rx={1.4} ry={4.5} fill="#0A1F25" />
      <ellipse cx={72} cy={60} rx={1.4} ry={4.5} fill="#0A1F25" />
      <circle cx={46} cy={58} r={1.1} fill="#FFFFFF" />
      <circle cx={70} cy={58} r={1.1} fill="#FFFFFF" />

      {/* Pink nose */}
      <path
        d="M56 72 Q60 69 64 72 Q62 76 60 76 Q58 76 56 72 Z"
        fill="#E89AAE"
        stroke="#C97188"
        strokeWidth={0.6}
      />

      {/* Mouth */}
      <path
        d="M52 80 Q56 84 60 80 Q64 84 68 80"
        stroke="#3A1822"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Whiskers */}
      <path d="M28 70 L42 71" stroke="#A09595" strokeWidth={0.6} strokeLinecap="round" />
      <path d="M28 74 L42 74" stroke="#A09595" strokeWidth={0.6} strokeLinecap="round" />
      <path d="M78 71 L92 70" stroke="#A09595" strokeWidth={0.6} strokeLinecap="round" />
      <path d="M78 74 L92 74" stroke="#A09595" strokeWidth={0.6} strokeLinecap="round" />

      {/* Blush */}
      <ellipse cx={38} cy={72} rx={5.5} ry={3.5} fill={`url(#${id("blush")})`} />
      <ellipse cx={82} cy={72} rx={5.5} ry={3.5} fill={`url(#${id("blush")})`} />

      <g opacity={0.85}>
        <path
          d="M92 30 L93.2 33 L96 34.2 L93.2 35.4 L92 38.4 L90.8 35.4 L88 34.2 L90.8 33 Z"
          fill="#FBC9D6"
        />
      </g>
    </svg>
  );
}
