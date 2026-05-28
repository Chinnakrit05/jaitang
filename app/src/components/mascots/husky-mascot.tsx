/**
 * Husky mascot — น้องฮัสกี้. Gray top of head, white face mask, blue
 * almond eyes — the iconic husky look. Same layered approach as the
 * Shiba so the head reads three-dimensional.
 */
export function HuskyMascot({
  size = 94,
  idPrefix = "husky",
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
          <stop offset="0" stopColor="#9DB9D2" />
          <stop offset="0.55" stopColor="#6F8DAD" />
          <stop offset="1" stopColor="#4A6685" />
        </linearGradient>
        <linearGradient id={id("ear")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7A98B8" />
          <stop offset="1" stopColor="#3F5872" />
        </linearGradient>
        <linearGradient id={id("face")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DEE7F0" />
        </linearGradient>
        <radialGradient id={id("eye")} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#5BAEE6" />
          <stop offset="1" stopColor="#1D5A8E" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={108} rx={26} ry={3.4} fill="rgba(40,55,80,0.2)" />

      {/* Outer ears */}
      <path
        d="M32 46 Q26 18 32 16 Q40 20 48 38 Z"
        fill={`url(#${id("fur")})`}
      />
      <path
        d="M88 46 Q94 18 88 16 Q80 20 72 38 Z"
        fill={`url(#${id("fur")})`}
      />
      {/* Inner ears */}
      <path d="M35 42 Q32 24 35 22 Q40 28 46 38 Z" fill={`url(#${id("ear")})`} />
      <path d="M85 42 Q88 24 85 22 Q80 28 74 38 Z" fill={`url(#${id("ear")})`} />

      {/* Head (gray top) */}
      <ellipse
        cx={60}
        cy={66}
        rx={32}
        ry={28}
        fill={`url(#${id("fur")})`}
      />
      <ellipse cx={52} cy={50} rx={14} ry={6} fill="#FFFFFF" opacity={0.2} />

      {/* White face mask — classic husky V-shape down the muzzle */}
      <path
        d="M30 68 Q42 60 50 64 Q60 56 70 64 Q78 60 90 68 Q86 88 72 92 Q60 96 48 92 Q34 88 30 68 Z"
        fill={`url(#${id("face")})`}
      />
      <path
        d="M54 50 Q60 62 66 50 Q68 64 60 72 Q52 64 54 50 Z"
        fill={`url(#${id("face")})`}
      />

      {/* Eyes — bright blue almond */}
      <path
        d="M42 62 Q48 56 54 62 Q48 67 42 62 Z"
        fill={`url(#${id("eye")})`}
      />
      <path
        d="M66 62 Q72 56 78 62 Q72 67 66 62 Z"
        fill={`url(#${id("eye")})`}
      />
      <circle cx={47} cy={61} r={1.5} fill="#0A1F35" />
      <circle cx={71} cy={61} r={1.5} fill="#0A1F35" />
      <circle cx={45.5} cy={59.5} r={0.9} fill="#FFFFFF" />
      <circle cx={69.5} cy={59.5} r={0.9} fill="#FFFFFF" />

      {/* Eyebrow tufts (husky face markings) */}
      <path
        d="M40 54 Q44 51 50 54"
        stroke="#4A6685"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d="M70 54 Q76 51 80 54"
        stroke="#4A6685"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
        opacity={0.7}
      />

      {/* Nose */}
      <path
        d="M55 74 Q60 70 65 74 Q63 79 60 79 Q57 79 55 74 Z"
        fill="#1A1A1A"
      />
      <ellipse cx={58.5} cy={73.5} rx={0.9} ry={0.6} fill="#FFFFFF" opacity={0.6} />

      {/* Mouth */}
      <path
        d="M52 84 Q56 88 60 84 Q64 88 68 84"
        stroke="#1A1A1A"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
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
