/** Quiet, accessible loading state for operational tables and queues. */
export function ConsoleLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading console data" className="flex flex-col gap-2 rounded-lg border border-line bg-card p-5">
      <span className="sr-only">Loading console data</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-11 animate-pulse rounded-md bg-surface" />
      ))}
    </div>
  );
}
