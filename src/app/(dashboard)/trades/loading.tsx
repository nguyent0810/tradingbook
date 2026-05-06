export default function TradesLoading() {
  return (
    <div className="page-container">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="skeleton mb-2 h-7 w-24" />
          <div className="skeleton h-4 w-20" />
        </div>
        <div className="skeleton h-10 w-28 rounded-lg" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-3">
        <div className="skeleton h-10 flex-1 rounded-lg sm:max-w-xs" />
        <div className="skeleton h-10 w-36 rounded-lg" />
        <div className="skeleton h-10 w-36 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="mt-4 card overflow-hidden">
        {/* Header row */}
        <div
          className="flex gap-4 px-4 py-3"
          style={{ background: "var(--bg-secondary)" }}
        >
          {[72, 64, 64, 88, 64, 96, 40, 72, 64, 88, 40, 56, 48].map((w, i) => (
            <div key={i} className="skeleton h-3" style={{ width: `${w}px` }} />
          ))}
        </div>

        {/* Data rows */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex gap-4 border-t px-4 py-3"
            style={{ borderColor: "var(--border-primary)" }}
          >
            {[56, 52, 52, 76, 52, 84, 36, 60, 52, 76, 36, 48, 44].map((w, j) => (
              <div
                key={j}
                className="skeleton h-4"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
