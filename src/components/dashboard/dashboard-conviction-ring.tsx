import type { ConfidenceBand } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardConvictionRingProps = {
  band: ConfidenceBand;
};

/** Ring fill + color per band — 3 discrete tiers, not a synthesized percentage
 *  (the underlying model only ever produces high/medium/low, never a raw score). */
const BAND_CONFIG: Record<ConfidenceBand, { fillPct: number; color: string; label: string }> = {
  high: { fillPct: 88, color: "var(--success)", label: "High" },
  medium: { fillPct: 58, color: "var(--warning)", label: "Medium" },
  low: { fillPct: 28, color: "var(--text-tertiary)", label: "Low" },
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DashboardConvictionRing({ band }: DashboardConvictionRingProps) {
  const config = BAND_CONFIG[band];
  const offset = CIRCUMFERENCE - (config.fillPct / 100) * CIRCUMFERENCE;

  return (
    <div className="dash-conviction-ring" data-testid="dashboard-conviction-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="dash-conviction-ring__track" cx="50" cy="50" r={RADIUS} />
        <circle
          className="dash-conviction-ring__fill"
          cx="50"
          cy="50"
          r={RADIUS}
          style={{
            stroke: config.color,
            strokeDasharray: CIRCUMFERENCE,
            ["--dash-ring-offset" as string]: offset,
          }}
        />
      </svg>
      <div className="dash-conviction-ring__center">
        <span className="dash-conviction-ring__label" style={{ color: config.color }}>
          {config.label}
        </span>
        <span className="dash-conviction-ring__caption">Evidence</span>
      </div>
    </div>
  );
}
