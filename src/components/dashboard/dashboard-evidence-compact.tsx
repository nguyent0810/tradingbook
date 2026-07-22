import type { ActionableBlockerDto, EvidenceChipDto } from "@/lib/dashboard/decision-cockpit-dto";

export type DashboardEvidenceCompactProps = {
  chips: EvidenceChipDto[];
  blockers?: ActionableBlockerDto[];
};

const INLINE_CHIP_ORDER = [
  "gate1",
  "gate1_live",
  "surfaced",
  "tier_a",
  "tier_b",
  "aligned",
  "vnindex",
  "market_foreign_1d",
  "market_foreign_coverage",
  "market_foreign_5d",
  "market_foreign_10d",
  "scan_at",
] as const;

function sortChipsForInline(chips: EvidenceChipDto[]): EvidenceChipDto[] {
  const order = new Map(INLINE_CHIP_ORDER.map((id, i) => [id, i]));
  return [...chips].sort((a, b) => {
    const ai = order.get(a.id as (typeof INLINE_CHIP_ORDER)[number]) ?? 99;
    const bi = order.get(b.id as (typeof INLINE_CHIP_ORDER)[number]) ?? 99;
    return ai - bi;
  });
}

/**
 * Safe/caution/danger coloring so the chip row reads at a glance, not just
 * on hover-title. Presentation-only — inspects the same `id`/`display`
 * strings already produced by buildEvidenceStack, no DTO changes.
 */
function chipTone(chip: EvidenceChipDto): "safe" | "warn" | "danger" | null {
  if (chip.id === "gate1" || chip.id === "gate1_live") {
    if (chip.display === "Favorable") return "safe";
    if (chip.display === "Caution") return "warn";
    if (chip.display === "Hostile") return "danger";
    return null;
  }
  if (chip.id === "aligned") {
    return chip.display === "Yes" ? "safe" : "warn";
  }
  if (chip.id.startsWith("market_foreign_") && chip.id !== "market_foreign_coverage") {
    if (chip.display.startsWith("+")) return "safe";
    if (chip.display.startsWith("−") || chip.display.startsWith("-")) return "danger";
    return null;
  }
  return null;
}

export function DashboardEvidenceCompact({
  chips,
  blockers = [],
}: DashboardEvidenceCompactProps) {
  const inline = sortChipsForInline(chips).slice(0, 6);

  return (
    <div
      className="dash-evidence-compact"
      data-testid="dashboard-evidence-stack"
      aria-labelledby="dashboard-evidence-heading"
    >
      <div className="dash-evidence-compact__inline" data-testid="dashboard-evidence-chips">
        {inline.map((chip) => (
          <span
            key={chip.id}
            className={`dash-hint-chip${chipTone(chip) ? ` dash-hint-chip--${chipTone(chip)}` : ""}`}
            data-testid={`dashboard-evidence-chip-${chip.id}`}
            title={
              chip.hint
                ? `${chip.label}: ${chip.display} (${chip.provenance}) — ${chip.hint}`
                : `${chip.label}: ${chip.display} (${chip.provenance})`
            }
          >
            <span className="dash-hint-chip__label">{chip.label}</span>
            <span className="dash-hint-chip__value">{chip.display}</span>
          </span>
        ))}
        {blockers.slice(0, 1).map((b) => (
          <span
            key={`blocker-${b.title}`}
            className="dash-hint-chip dash-hint-chip--warn"
            data-testid="dashboard-evidence-blocker-chip"
            title={`${b.meaning} — ${b.waitFor}`}
          >
            <span className="dash-hint-chip__label">{b.title}</span>
            <span className="dash-hint-chip__value tabular-nums">{b.count}</span>
          </span>
        ))}
      </div>

      <details className="dash-evidence-compact__details">
        <summary className="dash-evidence-compact__summary" id="dashboard-evidence-heading">
          Vì sao có phán quyết này?
        </summary>
        <div className="dash-evidence-compact__expanded">
          <div className="dash-evidence__chips dash-evidence__chips--wrap">
            {chips.map((chip) => (
              <div
                key={chip.id}
                className="dash-evidence-chip dash-evidence-chip--sm"
                data-testid={`dashboard-evidence-chip-${chip.id}`}
                title={chip.hint ? `Source: ${chip.provenance} — ${chip.hint}` : `Source: ${chip.provenance}`}
              >
                <span className="dash-evidence-chip__label">{chip.label}</span>
                <span className="dash-evidence-chip__value">{chip.display}</span>
              </div>
            ))}
          </div>
          {blockers.length > 0 ? (
            <ul className="dash-evidence-compact__blocker-list">
              {blockers.slice(0, 3).map((b) => (
                <li key={`${b.severity}-${b.title}`}>
                  <strong>{b.title}</strong> ({b.count}) — {b.meaning}
                </li>
              ))}
            </ul>
          ) : null}
          {chips.find((c) => c.id === "aligned") ? (
            <p className="dash-evidence__caption" data-testid="dashboard-evidence-caption">
              Đồng bộ dữ liệu: {chips.find((c) => c.id === "aligned")!.display}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
