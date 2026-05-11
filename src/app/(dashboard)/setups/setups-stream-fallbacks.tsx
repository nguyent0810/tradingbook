export function SetupsTopFallback() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div
        className="rounded-xl border-2 p-7 sm:p-8"
        style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
      >
        <div className="skeleton mb-4 h-3 w-36 rounded-md" />
        <div className="skeleton mb-3 h-10 w-full max-w-lg rounded-md" />
        <div className="skeleton h-20 w-full max-w-3xl rounded-md" />
      </div>
      <div className="card space-y-3 p-6">
        <div className="skeleton h-6 w-2/3 max-w-xl rounded-md" />
        <div className="skeleton h-4 w-full rounded-md" />
        <div className="skeleton h-4 w-[90%] rounded-md" />
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
          <div className="skeleton h-12 rounded-lg" />
          <div className="skeleton h-12 rounded-lg" />
          <div className="skeleton h-12 rounded-lg" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-5 w-48 rounded-md" />
        <div className="skeleton h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function SetupsCandidatesFallback() {
  return (
    <section className="space-y-3" aria-busy="true">
      <div className="skeleton h-6 w-56 rounded-md" />
      <div className="skeleton h-4 w-72 rounded-md" />
      <div className="table-container overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-primary)" }}>
        <div className="flex gap-2 border-b p-3" style={{ borderColor: "var(--border-primary)" }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="skeleton h-4 flex-1 rounded-md" />
          ))}
        </div>
        {[...Array(4)].map((_, r) => (
          <div key={r} className="flex gap-2 border-b p-3 last:border-0" style={{ borderColor: "var(--border-primary)" }}>
            {[...Array(7)].map((_, c) => (
              <div key={c} className="skeleton h-5 flex-1 rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SetupsMomentumFallback() {
  return (
    <section
      className="space-y-3 rounded-lg border border-dashed p-4 md:p-5"
      style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
      aria-busy="true"
    >
      <div className="skeleton h-6 w-44 rounded-md" />
      <div className="skeleton h-4 w-72 rounded-md" />
      <div className="skeleton min-h-[140px] w-full rounded-lg" />
    </section>
  );
}

export function SetupsTailFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="skeleton h-36 w-full rounded-xl" />
      <div className="skeleton h-16 w-full rounded-lg" />
    </div>
  );
}
