export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-silver-200 bg-white p-4" aria-hidden="true">
          <div className="mb-2 h-4 w-1/3 rounded bg-silver-200" />
          <div className="mb-2 h-3 w-1/2 rounded bg-silver-200" />
          <div className="h-3 w-2/3 rounded bg-silver-200" />
        </div>
      ))}
    </div>
  );
}
