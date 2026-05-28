/**
 * Pug mascot — น้องปั๊ก. Tan head with droopy ears, dark wrinkled
 * muzzle area, big round eyes — classic pug face.
 */
export function PugMascot({
  size = 94,
  idPrefix = "pug",
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
          <stop offset="0" stopColor="#D9B894" />
          <stop offset="0.6" stopColor="#B58A65" />
          <stop offset="1" stopColor="#8B5A3C" />
        </linearGradient>
        <linearGradient id={id("ear")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5C3820" />
          <stop offset="1" stopColor="#3A2412" />
        </linearGradient>
        <radialGradient id={id("snout")} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#4A2E1A" />
          <stop offset="1" stopColor="#2A1808" />
        </radialGradient>
        <radialGradient id={id("eye")} cx="0.4" cy="0.35" r="0.85">
          <stop offset="0" stopColor="#5A3A22" />
          <stop offset="1" stopColor="#1A0F08" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={108} rx={26} ry={3.4} fill="rgba(50,30,15,0.22)" />

      {/* Head (tan) */}
      <ellipse
        cx={60}
        cy={66}
        rx={32}
        ry={28}
        fill={`url(#${id("fur")})`}
      />

      {/* Droopy folded ears — fold down over the side of head */}
      <path
        d="M26 50 Q22 56 26 68 Q34 76 38 66 Q38 56 32 50 Z"
        fill={`url(#${id("ear")})`}
      />
      <path
        d="M94 50 Q98 56 94 68 Q86 76 82 66 Q82 56 88 50 Z"
        fill={`url(#${id("ear")})`}
      />

      <ellipse cx={52} cy={50} rx={14} ry={6} fill="#FFFFFF" opacity={0.18} />

      {/* Black mask area around muzzle */}
      <ellipse cx={60} cy={78} rx={20} ry={14} fill={`url(#${id("snout")})`} />

      {/* Forehead wrinkle */}
      <path
        d="M52 50 Q60 46 68 50"
        stroke="#6E4422"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d="M50 56 Q60 53 70 56"
        stroke="#6E4422"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        opacity={0.45}
      />

      {/* Big round eyes */}
      <ellipse cx={48} cy={64} rx={6} ry={6.5} fill={`url(#${id("eye")})`} />
      <ellipse cx={72} cy={64} rx={6} ry={6.5} fill={`url(#${id("eye")})`} />
      {/* Eye highlights */}
      <circle cx={46} cy={62} r={1.8} fill="#FFFFFF" />
      <circle cx={70} cy={62} r={1.8} fill="#FFFFFF" />
      <circle cx={49.5} cy={66} r={0.7} fill="#FFFFFF" opacity={0.7} />
      <circle cx={73.5} cy={66} r={0.7} fill="#FFFFFF" opacity={0.7} />

      {/* Nose */}
      <path
        d="M55 76 Q60 72 65 76 Q63 81 60 81 Q57 81 55 76 Z"
        fill="#0A0606"
      />
      <ellipse cx={58.5} cy={75.5} rx={1} ry={0.7} fill="#FFFFFF" opacity={0.6} />

      {/* Mouth (tiny pug pout) + tongue */}
      <path
        d="M54 86 Q57 89 60 86 Q63 89 66 86"
        stroke="#0A0606"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M58 87 Q60 91 62 87 Z"
        fill="#F4A0B0"
        stroke="#D87090"
        strokeWidth={0.5}
      />

      <g opacity={0.85}>
        <path
          d="M92 30 L93.2 33 L96 34.2 L93.2 35.4 L92 38.4 L90.8 35.4 L88 34.2 L90.8 33 Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}
