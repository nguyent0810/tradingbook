import "../paper-lab-command-center.css";

export function ConfidenceRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="paper-lab-confidence-ring" aria-label={`${clamped}% confidence`}>
      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r={r + 4} fill="none" stroke="rgba(34,211,238,0.12)" strokeWidth="2" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="5" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--pl-cyan)"
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.35))" }}
        />
      </svg>
      <span className="paper-lab-confidence-ring__label">{Math.round(clamped)}%</span>
    </div>
  );
}
