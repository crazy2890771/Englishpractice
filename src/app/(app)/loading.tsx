export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2" />)}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
