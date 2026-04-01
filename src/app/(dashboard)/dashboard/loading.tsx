export default function DashboardLoading() {
  return (
    <div className="page-container">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="skeleton mb-2 h-7 w-32" />
          <div className="skeleton h-4 w-48" />
        </div>
        <div className="skeleton h-10 w-28 rounded-lg" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="metric-card">
            <div className="skeleton mb-3 h-4 w-24" />
            <div className="skeleton h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
