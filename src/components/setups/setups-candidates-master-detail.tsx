"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { ScanQuality } from "@/generated/prisma/client";
import type { SetupHealthLevelValue } from "@/lib/setup-health";
import { SetupsCandidatePositionSizing } from "@/components/setups-candidate-position-sizing";
import {
  SignalBadge,
  healthLevelToBadgeVariant,
  qualityToTierVariant,
} from "@/components/command-deck/signal-badge";
import {
  displayCandidateLifecycleSortLabel,
  displayScanQualityTier,
} from "@/lib/trading-display-labels";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import { RelativeStrengthDiagnosticPanel } from "@/components/scanner/relative-strength-diagnostic-panel";
import { formatScannerReasonForUser } from "@/lib/dashboard/v3-user-copy";
import {
  V3MasterDetail,
  type V3MasterDetailSelectorDensity,
} from "@/components/trading-os-v3/layout";
import {
  buildSetupsEvidenceItems,
  SetupsCandidateEvidence,
  SETUPS_EVIDENCE_PREVIEW_COUNT,
} from "@/components/setups/setups-candidate-evidence";

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

function selectorDensityForCount(count: number): V3MasterDetailSelectorDensity {
  if (count <= 1) return "single";
  if (count <= 3) return "compact";
  return "default";
}

function CandidateWorkstation({
  bundle,
  techOpen,
  techId,
  onToggleTech,
  onOpenTechnical,
}: {
  bundle: SetupsCandidateBundle;
  techOpen: boolean;
  techId: string;
  onToggleTech: () => void;
  onOpenTechnical: () => void;
}) {
  const { candidate, reasonsLines, rankBreakdownLines, rsRankPreviewLines, rsDiagnostic } = bundle;
  const tier = candidate.quality === "A" ? "A" : "B";
  const lifecycleVariant = candidate.lifecycleSortLabel === "READY" ? "ready" : "watching";

  const evidenceItems = buildSetupsEvidenceItems(reasonsLines, candidate.healthLines);
  const previewEvidence = evidenceItems.slice(0, SETUPS_EVIDENCE_PREVIEW_COUNT);

  const hasTechnicalDetail =
    evidenceItems.length > previewEvidence.length ||
    rankBreakdownLines.length > 0 ||
    rsRankPreviewLines.length > 0 ||
    rsDiagnostic != null;

  const extraEvidence = evidenceItems.slice(SETUPS_EVIDENCE_PREVIEW_COUNT);

  return (
    <article
      className="tosv3-setups-workstation-panel"
      data-testid={`setups-candidate-detail-${candidate.symbolKey}`}
    >
      <header className="tosv3-setups-workstation-panel__header">
        <div className="tosv3-setups-workstation-panel__identity">
          <h3 className="tosv3-setups-workstation-panel__symbol mono">{candidate.symbolKey}</h3>
          <div className="tosv3-setups-workstation-panel__badges">
            <SignalBadge variant={lifecycleVariant}>
              {displayCandidateLifecycleSortLabel(candidate.lifecycleSortLabel)}
            </SignalBadge>
            <SignalBadge variant={qualityToTierVariant(tier)}>
              {displayScanQualityTier(candidate.quality)}
            </SignalBadge>
            <SignalBadge
              variant={healthLevelToBadgeVariant(candidate.healthLevel)}
              title={`Health: ${candidate.healthLevel.replace("_", " ")}`}
            >
              {candidate.healthLevel.replace("_", " ")}
            </SignalBadge>
            <span className="tosv3-setups-workstation-panel__score tabular-nums">
              {candidate.healthScoreLabel} · {candidate.healthScore}
            </span>
          </div>
        </div>
        <Link
          href={`/trades/new?setupCandidateId=${candidate.id}`}
          className="tosv3-btn tosv3-btn--primary tosv3-btn--sm"
        >
          Log trade
        </Link>
      </header>

      <dl className="tosv3-setups-metric-strip" aria-label="Key levels">
        <div className="tosv3-setups-metric-card">
          <dt>Close</dt>
          <dd className="tabular-nums">{fmtThousands(candidate.close)}</dd>
        </div>
        <div className="tosv3-setups-metric-card">
          <dt>Stop</dt>
          <dd className="tabular-nums">{fmtThousands(candidate.stopLevel)}</dd>
        </div>
        <div className="tosv3-setups-metric-card">
          <dt>Zone</dt>
          <dd className="tabular-nums">
            {fmtThousands(candidate.pullbackZoneLow)} – {fmtThousands(candidate.pullbackZoneHigh)}
          </dd>
        </div>
        <div className="tosv3-setups-metric-card">
          <dt>Bar</dt>
          <dd>{candidate.barDate}</dd>
        </div>
        <div className="tosv3-setups-metric-card">
          <dt>Setup score</dt>
          <dd className="tabular-nums">{bundle.rankScore.toFixed(2)}</dd>
        </div>
      </dl>

      {bundle.perfHint ? <p className="tosv3-setups-workstation-panel__hint">{bundle.perfHint}</p> : null}

      {candidate.healthSummary ? (
        <p className="tosv3-setups-workstation-panel__summary">{humanizeLine(candidate.healthSummary)}</p>
      ) : null}

      {candidate.healthHint ? (
        <p className="tosv3-setups-workstation-panel__meta">{humanizeLine(candidate.healthHint)}</p>
      ) : null}

      <SetupsCandidateEvidence
        items={evidenceItems}
        technicalAvailable={hasTechnicalDetail}
        onOpenTechnical={() => {
          if (!techOpen) onOpenTechnical();
        }}
      />

      {hasTechnicalDetail ? (
        <div className="tosv3-setups-tech-block">
          <button
            type="button"
            className="tosv3-setups-tech-block__toggle"
            aria-expanded={techOpen}
            aria-controls={techId}
            onClick={onToggleTech}
          >
            {techOpen ? "Hide" : "Show"} technical evidence
          </button>
          {techOpen ? (
            <div id={techId} className="tosv3-setups-tech-block__body">
              {extraEvidence.length > 0 ? (
                <ul className="tosv3-setups-evidence-grid tosv3-setups-evidence-grid--dense">
                  {extraEvidence.map((item) => (
                    <li
                      key={`extra-${item.key}`}
                      className={`tosv3-setups-evidence-item${item.tone === "ok" ? " tosv3-setups-evidence-item--ok" : ""}`}
                      title={item.text}
                    >
                      {item.text}
                    </li>
                  ))}
                </ul>
              ) : null}
              <RelativeStrengthDiagnosticPanel
                diagnostic={rsDiagnostic}
                compact
                testId="setups-candidate-rs-panel"
              />
              {rankBreakdownLines.length > 0 ? (
                <ul className="tosv3-setups-tech-block__list" data-testid="setups-candidate-rank-breakdown">
                  {rankBreakdownLines.map((line, i) => (
                    <li key={`rank-${i}`}>{humanizeLine(line)}</li>
                  ))}
                </ul>
              ) : null}
              {rsRankPreviewLines.length > 0 ? (
                <ul className="tosv3-setups-tech-block__list">
                  {rsRankPreviewLines.map((line, i) => (
                    <li key={`rs-${i}`}>{humanizeLine(line)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="tosv3-setups-workstation-panel__section tosv3-setups-workstation-panel__section--sizing">
        <h4 className="tosv3-setups-workstation-panel__section-title">Position sizing</h4>
        <SetupsCandidatePositionSizing
          symbolKey={candidate.symbolKey}
          quality={tier}
          defaultEntryKVnd={candidate.close}
          defaultStopKVnd={candidate.stopLevel}
        />
      </section>
    </article>
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

  const manyCandidates = candidates.length > 5;
  const selectorDensity = selectorDensityForCount(candidates.length);

  return (
    <V3MasterDetail
      scrollSelector={manyCandidates}
      selectorDensity={selectorDensity}
      className="tosv3-setups-candidates-master-detail"
    >
      <V3MasterDetail.Selector>
        <div className="tosv3-setups-selector">
          <p className="tosv3-setups-selector__label">
            <span className="tosv3-kicker">Candidates</span>
            <span className="tosv3-setups-selector__count tabular-nums">{candidates.length}</span>
          </p>
          <div className="tosv3-setups-selector__scroll">
            <table className="tosv3-setups-selector-table" aria-label="Surfaced candidates">
              <thead>
                <tr>
                  <th>Sym</th>
                  <th>Tier</th>
                  <th className="table-num">Scr</th>
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
                      ? "tosv3-setups-selector-table__row--ready"
                      : candidate.healthLevel === "AT_RISK"
                        ? "tosv3-setups-selector-table__row--at-risk"
                        : "";
                  return (
                    <tr
                      key={candidate.id}
                      tabIndex={0}
                      data-testid="setups-candidate-row"
                      aria-current={isSelected ? "true" : undefined}
                      className={`tosv3-setups-selector-table__row ${rowAttention}${isSelected ? " is-selected" : ""}`}
                      onClick={() => select(candidate.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(candidate.id);
                        }
                      }}
                    >
                      <td className="tosv3-setups-selector-table__symbol mono">{candidate.symbolKey}</td>
                      <td>
                        <SignalBadge
                          variant={qualityToTierVariant(tier)}
                          className="tosv3-setups-selector-table__tier"
                        >
                          {tier}
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
        </div>
      </V3MasterDetail.Selector>

      {selected ? (
        <V3MasterDetail.Detail>
          <CandidateWorkstation
            bundle={selected}
            techOpen={techOpen}
            techId={techId}
            onToggleTech={() => setTechOpen((v) => !v)}
            onOpenTechnical={() => setTechOpen(true)}
          />
        </V3MasterDetail.Detail>
      ) : null}
    </V3MasterDetail>
  );
}
