export function Loading({ label = 'Memuat data' }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="page-stack">
      <div className="skeleton skeleton-heading" />
      <div className="metric-grid">
        {[0, 1, 2, 3].map((item) => <div className="skeleton skeleton-card" key={item} />)}
      </div>
      <div className="skeleton skeleton-panel" />
    </div>
  )
}
