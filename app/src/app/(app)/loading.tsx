/**
 * Generic loading skeleton for any protected route. Renders instantly during
 * navigation while the server component re-renders + fetches data.
 *
 * Per-route loading.tsx files (e.g. dashboard/loading.tsx) override this
 * with a more specific shape when it helps.
 */
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded soft-raised-sm" />
          <div className="h-4 w-64 rounded soft-raised-sm" />
        </div>
        <div className="h-10 w-32 rounded-full soft-raised-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card />
        <Card />
        <Card />
      </div>

      <div className="rounded-[22px] soft-raised p-6 h-48" />
    </div>
  );
}

function Card() {
  return (
    <div className="rounded-[22px] soft-raised p-5 h-24">
      <div className="h-3 w-24 rounded bg-(--background) mb-3" />
      <div className="h-7 w-32 rounded bg-(--background)" />
    </div>
  );
}
