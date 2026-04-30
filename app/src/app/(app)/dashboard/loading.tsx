export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-(--card) border border-(--border)" />
          <div className="h-4 w-56 rounded bg-(--card) border border-(--border)" />
        </div>
        <div className="h-10 w-32 rounded-full bg-(--card) border border-(--border)" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-(--card) border border-(--border)" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-(--card) border border-(--border)" />
        <div className="h-64 rounded-2xl bg-(--card) border border-(--border)" />
      </div>

      <div className="rounded-2xl border border-(--border) bg-(--card) divide-y divide-(--border) overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
