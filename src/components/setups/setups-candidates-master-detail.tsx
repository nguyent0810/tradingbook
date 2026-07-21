"use client";

import { memo, useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
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
import {
  V3MasterDetail,
  type V3MasterDetailSelectorDensity,
} from "@/components/trading-os-v3/layout";
import {
  buildSetupsEvidenceItems,
  SetupsCandidateEvidence,
  SETUPS_EVIDENCE_PREVIEW_COUNT,
} from "@/components/setups/setups-candidate-evidence";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

/** Account-level position-sizing defaults from Settings — decimal fractions (0.15 = 15%). */
export type SetupsPositionSizingDefaults = {
  equityVnd: number | null;
  baseRiskPct: number | null;
  maxTradePct: number | null;
  liquidityCapPct: number | null;
};

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
    /** 20-session average daily traded value (VND) — used for the liquidity-cap sizing constraint. */
    avgValueVnd20: number | null;
  };
  perfHint: string;
  reasonsLines: string[];
  marketContextLines: string[];
  rankScore: number;
  rankBreakdownLines: string[];
  rsRankPreviewLines: string[];
  rsDiagnostic: RsDiagnosticUi | null;
};

function fmtThousands(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function selectorDensityForCount(count: number): V3MasterDetailSelectorDensity {
  if (count <= 1) return "single";
  if (count <= 3) return "compact";
  return "default";
}

type CandidateSelectorRow = {
  id: string;
  symbolKey: string;
  tier: "A" | "B";
  healthScore: number;
  closeDisplay: string;
  stopDisplay: string;
  rowAttention: string;
};

const CandidateSelectorRowItem = memo(function CandidateSelectorRowItem({
  row,
  isSelected,
  onSelect,
}: {
  row: CandidateSelectorRow;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const handleClick = useCallback(() => onSelect(row.id), [onSelect, row.id]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(row.id);
      }
    },
    [onSelect, row.id]
  );

  return (
    <tr
      tabIndex={0}
      data-testid="setups-candidate-row"
      aria-current={isSelected ? "true" : undefined}
      className={`tosv3-setups-selector-table__row ${row.rowAttention}${isSelected ? " is-selected" : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <td className="tosv3-setups-selector-table__symbol mono">{row.symbolKey}</td>
      <td>
        <SignalBadge
          variant={qualityToTierVariant(row.tier)}
          className="tosv3-setups-selector-table__tier"
        >
          {row.tier}
        </SignalBadge>
      </td>
      <td className="table-num tabular-nums">{row.healthScore}</td>
      <td className="table-num tabular-nums">{row.closeDisplay}</td>
      <td className="table-num tabular-nums">{row.stopDisplay}</td>
    </tr>
  );
});

function DeferredPositionSizing({
  symbolKey,
  quality,
  defaultEntryKVnd,
  defaultStopKVnd,
  initialEquityVnd,
  initialBaseRiskPct,
  initialMaxTradePct,
  initialLiquidityCapPct,
  symbolAvgDailyValueVnd,
}: {
  symbolKey: string;
  quality: "A" | "B";
  defaultEntryKVnd: number;
  defaultStopKVnd: number;
  initialEquityVnd: number | null;
  initialBaseRiskPct: number | null;
  initialMaxTradePct: number | null;
  initialLiquidityCapPct: number | null;
  symbolAvgDailyValueVnd: number | null;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(handle);
  }, []);

  if (!mounted) {
    return <LoadingSkeleton className="min-h-[220px] w-full rounded-xl" aria-hidden />;
  }

  return (
    <SetupsCandidatePositionSizing
      symbolKey={symbolKey}
      quality={quality}
      defaultEntryKVnd={defaultEntryKVnd}
      defaultStopKVnd={defaultStopKVnd}
      initialEquityVnd={initialEquityVnd}
      initialBaseRiskPct={initialBaseRiskPct}
      initialMaxTradePct={initialMaxTradePct}
      initialLiquidityCapPct={initialLiquidityCapPct}
      symbolAvgDailyValueVnd={symbolAvgDailyValueVnd}
    />
  );
}

const CandidateWorkstation = memo(function CandidateWorkstation({
  bundle,
  techOpen,
  techId,
  onToggleTech,
  onOpenTechnical,
  positionSizingDefaults,
}: {
  bundle: SetupsCandidateBundle;
  techOpen: boolean;
  techId: string;
  onToggleTech: () => void;
  onOpenTechnical: () => void;
  positionSizingDefaults: SetupsPositionSizingDefaults | undefined;
}) {
  const { candidate, reasonsLines, marketContextLines, rankBreakdownLines, rsRankPreviewLines, rsDiagnostic } = bundle;
  const tier = candidate.quality === "A" ? "A" : "B";
  const lifecycleVariant = candidate.lifecycleSortLabel === "READY" ? "ready" : "watching";

  const evidenceItems = useMemo(
    () => buildSetupsEvidenceItems(reasonsLines, candidate.healthLines, marketContextLines),
    [candidate.healthLines, marketContextLines, reasonsLines]
  );
  const previewEvidence = useMemo(
    () => evidenceItems.slice(0, SETUPS_EVIDENCE_PREVIEW_COUNT),
    [evidenceItems]
  );

  const hasTechnicalDetail =
    evidenceItems.length > previewEvidence.length ||
    rankBreakdownLines.length > 0 ||
    rsRankPreviewLines.length > 0 ||
    rsDiagnostic != null;

  const extraEvidence = useMemo(
    () => evidenceItems.slice(SETUPS_EVIDENCE_PREVIEW_COUNT),
    [evidenceItems]
  );

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
          href={`/paper-lab?setupCandidateId=${candidate.id}`}
          className="tosv3-btn tosv3-btn--primary tosv3-btn--sm"
        >
          Validate setup
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
        <p className="tosv3-setups-workstation-panel__summary">{candidate.healthSummary}</p>
      ) : null}

      {candidate.healthHint ? (
        <p className="tosv3-setups-workstation-panel__meta">{candidate.healthHint}</p>
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
                    <li key={`rank-${i}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {rsRankPreviewLines.length > 0 ? (
                <ul className="tosv3-setups-tech-block__list">
                  {rsRankPreviewLines.map((line, i) => (
                    <li key={`rs-${i}`}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="tosv3-setups-workstation-panel__section tosv3-setups-workstation-panel__section--sizing">
        <h4 className="tosv3-setups-workstation-panel__section-title">Position sizing</h4>
        <DeferredPositionSizing
          symbolKey={candidate.symbolKey}
          quality={tier}
          defaultEntryKVnd={candidate.close}
          defaultStopKVnd={candidate.stopLevel}
          initialEquityVnd={positionSizingDefaults?.equityVnd ?? null}
          initialBaseRiskPct={positionSizingDefaults?.baseRiskPct ?? null}
          initialMaxTradePct={positionSizingDefaults?.maxTradePct ?? null}
          initialLiquidityCapPct={positionSizingDefaults?.liquidityCapPct ?? null}
          symbolAvgDailyValueVnd={candidate.avgValueVnd20}
        />
      </section>
    </article>
  );
});

type Props = {
  candidates: SetupsCandidateBundle[];
  positionSizingDefaults?: SetupsPositionSizingDefaults;
};

export function SetupsCandidatesMasterDetail({ candidates, positionSizingDefaults }: Props) {
  const techId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(candidates[0]?.candidate.id ?? null);
  const [techOpen, setTechOpen] = useState(false);

  const selected = useMemo(
    () => candidates.find((c) => c.candidate.id === selectedId) ?? candidates[0] ?? null,
    [candidates, selectedId]
  );

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setTechOpen(false);
  }, []);

  const manyCandidates = candidates.length > 5;
  const selectorDensity = selectorDensityForCount(candidates.length);
  const handleToggleTech = useCallback(() => setTechOpen((v) => !v), []);
  const handleOpenTechnical = useCallback(() => setTechOpen(true), []);
  const selectorRows = useMemo<CandidateSelectorRow[]>(
    () =>
      candidates.map((bundle) => {
        const { candidate } = bundle;
        const tier = candidate.quality === "A" ? "A" : "B";
        const rowAttention =
          candidate.lifecycleSortLabel === "READY"
            ? "tosv3-setups-selector-table__row--ready"
            : candidate.healthLevel === "AT_RISK"
              ? "tosv3-setups-selector-table__row--at-risk"
              : "";
        return {
          id: candidate.id,
          symbolKey: candidate.symbolKey,
          tier,
          healthScore: candidate.healthScore,
          closeDisplay: fmtThousands(candidate.close),
          stopDisplay: fmtThousands(candidate.stopLevel),
          rowAttention,
        };
      }),
    [candidates]
  );

  if (candidates.length === 0) return null;

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
                {selectorRows.map((row) => (
                  <CandidateSelectorRowItem
                    key={row.id}
                    row={row}
                    isSelected={selected?.candidate.id === row.id}
                    onSelect={select}
                  />
                ))}
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
            onToggleTech={handleToggleTech}
            onOpenTechnical={handleOpenTechnical}
            positionSizingDefaults={positionSizingDefaults}
          />
        </V3MasterDetail.Detail>
      ) : null}
    </V3MasterDetail>
  );
}
