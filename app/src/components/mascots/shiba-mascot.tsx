/**
 * The Jaitang Shiba mascot — a polished, gradient-shaded SVG inu.
 *
 * Ported from `jaitang-mobile/components/ShibaMascot.tsx` (react-native-svg)
 * to plain web SVG so it works in the Next.js app.
 *
 * Built up in layers (back → front) so the face reads as 3D-ish even
 * though everything is flat shapes: chest fluff sits behind the head,
 * the head has a top-down warm gradient (lighter on top), the cream
 * face mask has soft edges via a subtle radial highlight, and the
 * eyes carry two specular dots so they don't look dead.
 *
 * `size` maps directly to the rendered width/height — viewBox is
 * 120×120 with the dog parked in the middle so giving it a tight
 * container (e.g. 76px) doesn't crop the ears or chest fluff.
 *
 * `idPrefix` namespaces the gradient ids — required when multiple
 * mascots render on the same page (browser de-dupes by id otherwise).
 */
export function ShibaMascot({
  size = 94,
  idPrefix = "shiba",
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
          <stop offset="0" stopColor="#F2A878" />
          <stop offset="0.55" stopColor="#E58B57" />
          <stop offset="1" stopColor="#C46F3F" />
        </linearGradient>
        <linearGradient id={id("ear")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBC9A4" />
          <stop offset="1" stopColor="#F19A6F" />
        </linearGradient>
        <linearGradient id={id("cream")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6EA" />
          <stop offset="1" stopColor="#FBE2C5" />
        </linearGradient>
        <linearGradient id={id("fluff")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FBE2C5" />
        </linearGradient>
        <radialGradient id={id("eye")} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#5A3624" />
          <stop offset="1" stopColor="#1F120A" />
        </radialGradient>
        <radialGradient id={id("blush")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F58FA8" stopOpacity="0.85" />
          <stop offset="1" stopColor="#F58FA8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={110} rx={26} ry={3.4} fill="rgba(58,40,24,0.18)" />

      <g>
        <path
          d="M38 86 Q44 96 50 98 Q60 102 70 98 Q76 96 82 86 Q80 100 70 104 Q60 108 50 104 Q40 100 38 86 Z"
          fill={`url(#${id("fluff")})`}
          stroke="#E9B98D"
          strokeWidth={0.6}
          strokeOpacity={0.5}
        />
        <path
          d="M48 92 Q50 96 53 93"
          stroke="#E9B98D"
          strokeWidth={0.7}
          strokeOpacity={0.45}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M67 92 Q70 96 72 93"
          stroke="#E9B98D"
          strokeWidth={0.7}
          strokeOpacity={0.45}
          fill="none"
          strokeLinecap="round"
        />
      </g>

      <path
        d="M32 44 Q26 18 30 16 Q36 18 46 36 Z"
        fill={`url(#${id("fur")})`}
        stroke="#A55C30"
        strokeWidth={0.8}
        strokeOpacity={0.35}
        strokeLinejoin="round"
      />
      <path
        d="M88 44 Q94 18 90 16 Q84 18 74 36 Z"
        fill={`url(#${id("fur")})`}
        stroke="#A55C30"
        strokeWidth={0.8}
        strokeOpacity={0.35}
        strokeLinejoin="round"
      />

      <path
        d="M34 40 Q31 24 34 22 Q38 26 44 36 Z"
        fill={`url(#${id("ear")})`}
        strokeLinejoin="round"
      />
      <path
        d="M86 40 Q89 24 86 22 Q82 26 76 36 Z"
        fill={`url(#${id("ear")})`}
        strokeLinejoin="round"
      />

      <ellipse
        cx={60}
        cy={64}
        rx={32}
        ry={28}
        fill={`url(#${id("fur")})`}
        stroke="#A55C30"
        strokeWidth={0.6}
        strokeOpacity={0.3}
      />

      <ellipse cx={52} cy={48} rx={12} ry={6} fill="#FFFFFF" opacity={0.18} />

      <path
        d="M30 66 Q42 56 60 60 Q78 56 90 66 Q86 86 72 90 Q60 94 48 90 Q34 86 30 66 Z"
        fill={`url(#${id("cream")})`}
      />

      <path
        d="M54 36 Q60 46 66 36 Q68 52 60 60 Q52 52 54 36 Z"
        fill={`url(#${id("cream")})`}
      />

      <ellipse cx={48} cy={58} rx={5.5} ry={3.6} fill="#FFFFFF" opacity={0.5} />
      <ellipse cx={72} cy={58} rx={5.5} ry={3.6} fill="#FFFFFF" opacity={0.5} />

      <path
        d="M44 58 Q48 53 52 58 Q48 61.5 44 58 Z"
        fill={`url(#${id("eye")})`}
      />
      <path
        d="M68 58 Q72 53 76 58 Q72 61.5 68 58 Z"
        fill={`url(#${id("eye")})`}
      />
      <circle cx={49.5} cy={57} r={1.1} fill="#FFFFFF" />
      <circle cx={73.5} cy={57} r={1.1} fill="#FFFFFF" />
      <circle cx={47} cy={59} r={0.5} fill="#FFFFFF" opacity={0.8} />
      <circle cx={71} cy={59} r={0.5} fill="#FFFFFF" opacity={0.8} />

      <path
        d="M44 51 Q48 49 51 51"
        stroke="#C46F3F"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
        opacity={0.65}
      />
      <path
        d="M69 51 Q72 49 76 51"
        stroke="#C46F3F"
        strokeWidth={1.2}
        fill="none"
        strokeLinecap="round"
        opacity={0.65}
      />

      <path
        d="M56 70 Q60 67 64 70 Q62 74 60 74 Q58 74 56 70 Z"
        fill="#231209"
      />
      <ellipse cx={58.5} cy={69.5} rx={0.9} ry={0.6} fill="#FFFFFF" opacity={0.7} />

      <path
        d="M52 78 Q56 82 60 78 Q64 82 68 78"
        stroke="#231209"
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M58 80 Q60 84 62 80 Z"
        fill="#F4A0B0"
        stroke="#E96B8E"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />

      <ellipse cx={36} cy={72} rx={5.5} ry={3.5} fill={`url(#${id("blush")})`} />
      <ellipse cx={84} cy={72} rx={5.5} ry={3.5} fill={`url(#${id("blush")})`} />

      <g opacity={0.85}>
        <path
          d="M92 30 L93.2 33 L96 34.2 L93.2 35.4 L92 38.4 L90.8 35.4 L88 34.2 L90.8 33 Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}
