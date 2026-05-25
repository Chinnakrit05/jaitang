/**
 * Donut chart with optional center label. Pure SVG, no chart lib — each
 * slice is a `<circle>` with the stroke-dasharray/offset trick. Ported
 * from `jaitang-mobile/components/Donut.tsx`, stripped of the reanimated
 * dependency since this version is a server component (Phase 5 can layer
 * a CSS-based intro animation on top without changing the API).
 *
 * Slices draw from 12 o'clock clockwise (the wrapping `<g>` rotates the
 * SVG -90°). When `data` is empty we render only the track ring so the
 * "no expenses" state still has a hole for the empty-state copy.
 *
 * Tiny slices (thinner than ~1.4× the stroke width) fall back to flat
 * caps — round caps look like blobs and pile up at boundaries when
 * dashes are short.
 */
export type DonutSlice = {
  value: number;
  color: string;
};

export function Donut({
  data,
  size = 108,
  strokeWidth = 16,
  trackColor = "color-mix(in srgb, var(--foreground) 8%, transparent)",
  label,
  centerValue,
  labelColor = "var(--muted)",
  centerColor = "var(--foreground)",
}: {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  label?: string;
  centerValue?: string;
  labelColor?: string;
  centerColor?: string;
}) {
  const r = 38;
  const C = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);
  const slices = total > 0 ? data : [];

  // Pre-compute each slice's stroke length + start offset so the JSX
  // map below is a pure transformation — no running variable mutation
  // during render (forbidden by the react-hooks/immutability lint).
  const drawn = slices.reduce<
    Array<{ dash: number; startOffset: number; color: string }>
  >((acc, slice) => {
    const dash = (slice.value / total) * C;
    const startOffset = acc.length === 0 ? 0 : acc[acc.length - 1].startOffset + acc[acc.length - 1].dash;
    acc.push({ dash, startOffset, color: slice.color });
    return acc;
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <g transform="rotate(-90 50 50)">
        {drawn.map((slice, i) => {
          const useRound = slice.dash > strokeWidth * 1.4;
          // The `donut-slice` keyframe (globals.css) tweens
          // `stroke-dashoffset` from `--slice-far` (slice hidden, dash
          // parked off-stage) to `--slice-offset` (its final position).
          // Each slice gets its own CSS vars so they animate from their
          // own start, not all from 12 o'clock.
          const sliceOffset = -slice.startOffset;
          const sliceFar = sliceOffset + slice.dash;
          return (
            <circle
              key={i}
              cx={50}
              cy={50}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${slice.dash} ${C - slice.dash}`}
              strokeLinecap={useRound ? "round" : "butt"}
              className="donut-slice"
              style={
                {
                  "--slice-offset": sliceOffset,
                  "--slice-far": sliceFar,
                  animationDelay: `${i * 80}ms`,
                } as React.CSSProperties
              }
            />
          );
        })}
      </g>
      {label ? (
        <text
          x={50}
          y={48}
          textAnchor="middle"
          fontSize={9}
          fill={labelColor}
        >
          {label}
        </text>
      ) : null}
      {centerValue ? (
        <text
          x={50}
          y={60}
          textAnchor="middle"
          fontSize={13}
          fontWeight="700"
          fill={centerColor}
        >
          {centerValue}
        </text>
      ) : null}
    </svg>
  );
}
