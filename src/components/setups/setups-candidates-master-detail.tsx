"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { ScanQuality } from "@/generated/prisma/client";
import type { SetupHealthLevelValue } from "@/lib/setup-health";
import { SetupsCandidateHealthStrip } from "@/components/setups-candidate-health-strip";
import { SetupsCandidatePositionSizing } from "@/components/setups-candidate-position-sizing";
import { SignalBadge, qualityToTierVariant } from "@/components/command-deck/signal-badge";
import { displayScanQualityTier } from "@/lib/trading-display-labels";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { formatScannerReasonForUser } from "@/lib/dashboard/v3-user-copy";

export type SetupsCandidateBundle = {
  candidate: {
    id: string;
    symbolKey: string;
    lifecycleSortLabel: "READY" | "WATCHING";
    healthLevel: SetupHealthLevelValue;
    healthScore: number;
    healthScoreLabel: "Strong" | "Decent" | "Weak" | "Risky";
    healthLines: string[];
    healthHint: string | null;
    healthSummary: string | null;
    quality: ScanQuality;
    close: number;
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    stopLevel: number;
    barDate: string;
    setupType: string;
  };
  perfHint: string;
  reasonsLines: string[];
  rankScore: number;
  rankBreakdownLines: string[];
  rsRankPreviewLines: string[];
  rsDiagnostic: RsDiagnosticUi | null;
};

function fmtThousands(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function humanizeLine(line: string): string {
  return formatScannerReasonForUser(line);
}

function CandidateDetailPanel({
  bundle,
  techOpen,
  techId,
  onToggleTech,
}: {
  bundle: SetupsCandidateBundle;
  techOpen: boolean;
  techId: string;
  onToggleTech: () => void;
}) {
  const { candidate, reasonsLines, rankBreakdownLines, rsRankPreviewLines, rsDiagnostic } = bundle;
  const tier = candidate.quality === "A" ? "A" : "B";
  const hasTechnicalDetail =
    rankBreakdownLines.length > 0 || rsRankPreviewLines.length > 0 || rsDiagnostic != null;

  return (
    <div className="tosv3-setups-detail" data-testid={`setups-candidate-detail-${candidate.symbolKey}`}>
      <header className="tosv3-setups-detail__head">
        <SetupsCandidateHealthStrip
          symbolKey={candidate.symbolKey}
          lifecycleSortLabel={candidate.lifecycleSortLabel}
          healthLevel={candidate.healthLevel}
          healthScore={candidate.healthScore}
          healthScoreLabel={candidate.healthScoreLabel}
          healthLines={candidate.healthLines}
          healthHint={candidate.healthHint}
          compact
        />
        <Link
          href={`/trades/new?setupCandidateId=${candidate.id}`}
          className="tosv3-btn tosv3-btn--primary tosv3-btn--sm"
        >
          Log trade
        </Link>
      </header>

      <dl className="tosv3-setups-detail__metrics">
        <div>
          <dt>Close</dt>
          <dd className="tabular-nums">{fmtThousands(candidate.close)}</dd>
        </div>
        <div>
          <dt>Zone</dt>
          <dd className="tabular-nums">
            {fmtThousands(candidate.pullbackZoneLow)} – {fmtThousands(candidate.pullbackZoneHigh)}
          </dd>
        </div>
        <div>
          <dt>Stop</dt>
          <dd className="tabular-nums">{fmtThousands(candidate.stopLevel)}</dd>
        </div>
        <div>
          <dt>Bar</dt>
          <dd>{candidate.barDate}</dd>
        </div>
      </dl>

      {bundle.perfHint ? <p className="tosv3-setups-detail__hint">{bundle.perfHint}</p> : null}

      {candidate.healthSummary || candidate.healthLines.length > 0 || candidate.healthHint ? (
        <div className="tosv3-setups-detail__card">
          {candidate.healthSummary ? (
            <p className="tosv3-setups-detail__insight">{humanizeLine(candidate.healthSummary)}</p>
          ) : null}
          {candidate.healthLines.length > 0 ? (
            <ul className="tosv3-setups-detail__chips">
              {candidate.healthLines.map((line, i) => (
                <li key={i} className="tosv3-setups-chip">
                  {humanizeLine(line)}
                </li>
              ))}
            </ul>
          ) : null}
          {candidate.healthHint ? (
            <p className="tosv3-setups-detail__meta">{humanizeLine(candidate.healthHint)}</p>
          ) : null}
        </div>
      ) : null}

      {reasonsLines.length > 0 ? (
        <ul className="tosv3-setups-detail__chips" aria-label="Why this setup surfaced">
          {reasonsLines.map((line, i) => (
            <li key={i} className="tosv3-setups-chip tosv3-setups-chip--ok">
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {hasTechnicalDetail ? (
        <div className="tosv3-tech-detail">
          <button
            type="button"
            className="tosv3-tech-detail__toggle"
            aria-expanded={techOpen}
            aria-controls={techId}
            onClick={onToggleTech}
          >
            {techOpen ? "Hide" : "Show"} technical evidence
          </button>
          {techOpen ? (
            <div id={techId} className="tosv3-tech-detail__body">
              <RelativeStrengthDiagnosticPanel
                diagnostic={rsDiagnostic}
                compact
                testId="setups-candidate-rs-panel"
              />
              {rankBreakdownLines.length > 0 ? (
                <ul className="tosv3-setups-detail__list" data-testid="setups-candidate-rank-breakdown">
                  {rankBreakdownLines.map((line, i) => (
                    <li key={`rank-${i}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="tosv3-setups-detail__sizing-details">
        <summary>Position sizing calculator</summary>
        <SetupsCandidatePositionSizing
          symbolKey={candidate.symbolKey}
          quality={tier}
          defaultEntryKVnd={candidate.close}
          defaultStopKVnd={candidate.stopLevel}
        />
      </details>
    </div>
  );
}

type Props = {
  candidates: SetupsCandidateBundle[];
};

export function SetupsCandidatesMasterDetail({ candidates }: Props) {
  const techId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(candidates[0]?.candidate.id ?? null);
  const [techOpen, setTechOpen] = useState(false);

  const selected =
    candidates.find((c) => c.candidate.id === selectedId) ?? candidates[0] ?? null;

  const select = (id: string) => {
    setSelectedId(id);
    setTechOpen(false);
  };

  if (candidates.length === 0) return null;

  const layoutClass =
    candidates.length <= 1
      ? "tosv3-setups-master-detail tosv3-setups-master-detail--single"
      : "tosv3-setups-master-detail";

  return (
    <div className={layoutClass}>
      <div className="tosv3-setups-master-detail__list-wrap">
        <table className="tosv3-setups-table dense-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Tier</th>
              <th className="table-num">Score</th>
              <th className="table-num">Close</th>
              <th className="table-num">Stop</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((bundle) => {
              const { candidate } = bundle;
              const tier = candidate.quality === "A" ? "A" : "B";
              const isSelected = selected?.candidate.id === candidate.id;
              const rowAttention =
                candidate.lifecycleSortLabel === "READY"
                  ? "tosv3-setups-table__row--ready"
                  : candidate.healthLevel === "AT_RISK"
                    ? "tosv3-setups-table__row--at-risk"
                    : "";
              return (
                <tr
                  key={candidate.id}
                  tabIndex={0}
                  data-testid="setups-candidate-row"
                  aria-current={isSelected ? "true" : undefined}
                  className={`tosv3-setups-table__row ${rowAttention}${isSelected ? " is-selected" : ""}`}
                  onClick={() => select(candidate.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(candidate.id);
                    }
                  }}
                >
                  <td className="tosv3-setups-table__symbol">{candidate.symbolKey}</td>
                  <td>
                    <SignalBadge variant={qualityToTierVariant(tier)}>
                      {displayScanQualityTier(candidate.quality)}
                    </SignalBadge>
                  </td>
                  <td className="table-num tabular-nums">{candidate.healthScore}</td>
                  <td className="table-num tabular-nums">{fmtThousands(candidate.close)}</td>
                  <td className="table-num tabular-nums">{fmtThousands(candidate.stopLevel)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected ? (
        <div className="tosv3-setups-master-detail__detail">
          <CandidateDetailPanel
            bundle={selected}
            techOpen={techOpen}
            techId={techId}
            onToggleTech={() => setTechOpen((v) => !v)}
          />
        </div>
      ) : null}
    </div>
  );
}
