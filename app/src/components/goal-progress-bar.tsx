import { cn } from "@/lib/utils";

/**
 * Linear progress bar for a savings goal. Visually clamps to 100% even
 * when the user has overshot — the badge shows the actual percentage
 * so it's still honest, just doesn't break the layout.
 */
export function GoalProgressBar({
  progress,
  color,
  size = "md",
  showLabel = false,
}: {
  /** 0..1 (or > 1 for over-target) */
  progress: number;
  /** Trip/goal color or null for accent default */
  color?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const truePct = Math.round(progress * 100);
  const accent = color ?? "var(--accent)";
  const heightCls = size === "lg" ? "h-3" : size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "w-full rounded-full bg-(--background) border border-(--border) overflow-hidden",
          heightCls
        )}
      >
        <div
          className="h-full transition-[width] duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: accent,
          }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-end text-[10px] text-(--muted) tabular-nums">
          {truePct}%
        </div>
      )}
    </div>
  );
}
