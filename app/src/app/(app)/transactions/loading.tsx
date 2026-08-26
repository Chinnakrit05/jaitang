export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded soft-raised-sm" />
          <div className="h-3 w-24 rounded soft-raised-sm" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-20 rounded-full soft-raised-sm" />
          <div className="h-10 w-32 rounded-full soft-raised-sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-full soft-raised-sm" />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl soft-raised-sm" />
        ))}
      </div>

      <div className="rounded-[22px] soft-raised divide-y divide-(--border) overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 px-4" />
        ))}
      </div>
    </div>
  );
}
