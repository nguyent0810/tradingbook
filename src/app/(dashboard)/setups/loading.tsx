export default function SetupsLoading() {
  return (
    <div className="page-container animate-in space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Setups
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Loading scanner context…
          </p>
        </div>
        <div className="skeleton h-5 w-28 rounded-md self-end" aria-hidden />
      </div>

      {/* Today's Action */}
      <div
        className="rounded-xl border-2 p-7 sm:p-8"
        style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
      >
        <div className="skeleton mb-4 h-3 w-32 rounded-md" />
        <div className="skeleton mb-3 h-10 w-3/4 max-w-lg rounded-md" />
        <div className="skeleton mb-2 h-6 w-48 rounded-md" />
        <div className="skeleton mt-4 h-16 w-full max-w-3xl rounded-md" />
      </div>

      {/* Market insight */}
      <section className="space-y-4">
        <div className="skeleton h-6 w-56 rounded-md" />
        <div className="card space-y-3 p-5">
          <div className="skeleton h-4 w-full rounded-md" />
          <div className="skeleton h-4 w-[92%] rounded-md" />
          <div className="skeleton h-4 w-[85%] rounded-md" />
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        </div>
      </section>

      {/* Diagnostics + candidates table placeholders */}
      <section className="space-y-3">
        <div className="skeleton h-6 w-40 rounded-md" />
        <div className="card p-5 space-y-3">
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-10 w-full rounded-lg" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="skeleton h-6 w-48 rounded-md" />
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

      {/* Momentum Watch stub */}
      <section
        className="space-y-3 rounded-lg border border-dashed p-4 md:p-5"
        style={{ borderColor: "var(--border-primary)", background: "var(--bg-secondary)" }}
      >
        <div className="skeleton h-6 w-44 rounded-md" />
        <div className="skeleton h-4 w-64 rounded-md" />
        <div className="skeleton h-24 w-full rounded-lg" />
      </section>
    </div>
  );
}
