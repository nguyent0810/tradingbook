/**
 * Portfolio Rotation — deterministic (flag-gated via the caller).
 *
 * When a manager would BUY a strong candidate but is blocked by full slots or
 * insufficient cash, it may reduce or exit its weakest holding to fund the
 * stronger opportunity. Pure: given the same bundles it always produces the same
 * plan. Execution reuses the existing REDUCE / EXIT / BUY engine paths and the
 * order validator (this module only produces decisions).
 *
 * Not implemented here: market memory, capital allocation, attribution.
 */
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { REASON_CODES } from "@/lib/paper-lab/contracts/reason-codes";
import type { FundManagerDna } from "@/lib/paper-lab/dna/fund-manager-dna";
import type { ManagerStateSnapshot } from "@/lib/paper-lab/dna/manager-state";
import { computeConfidenceBasis } from "@/lib/paper-lab/dna/confidence";
import { evaluateManager, deterministicUuid } from "@/lib/paper-lab/dna/evaluate-manager";

const R = REASON_CODES;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function rsSpread(b: MarketContextBundle, lookback: number): number | null {
  return b.relativeStrength?.returns.find((r) => r.lookbackSessions === lookback)?.rsSpreadPct ?? null;
}

function regimeFit(b: MarketContextBundle): number {
  const tr = b.marketRegime.regimeDimensions?.trendRegime;
  if (tr) return tr === "StrongBull" || tr === "WeakBull" ? 1 : tr === "Sideways" ? 0.5 : 0;
  return b.marketRegime.gate1Level === "PASS" ? 1 : b.marketRegime.gate1Level === "WARNING" ? 0.5 : 0;
}

function regimeClean(b: MarketContextBundle): boolean {
  const tr = b.marketRegime.regimeDimensions?.trendRegime;
  return b.marketRegime.gate1Level === "PASS" && (tr === undefined || tr === "StrongBull" || tr === "WeakBull");
}

/** Opportunity score of a fresh candidate (0..1, higher = stronger). */
export function opportunityScore(bundle: MarketContextBundle, dna: FundManagerDna): number {
  const q = bundle.gate2Setup?.quality;
  const g2 = q === "A" ? 1 : q === "B" ? 0.6 : 0;
  const rs = clamp(((rsSpread(bundle, 20) ?? 0) + (rsSpread(bundle, 50) ?? 0)) / 2 / 10, 0, 1);
  const cb = computeConfidenceBasis(bundle, dna.confidence);
  const span = dna.confidence.ceil - dna.confidence.floor || 1;
  const confN = clamp((cb.confidence - dna.confidence.floor) / span, 0, 1);
  return 0.35 * g2 + 0.25 * rs + 0.2 * confN + 0.2 * regimeFit(bundle);
}

/** Weakness score of an existing holding (0..1, LOWER = weaker/rotate-out). */
export function weakestHoldingScore(bundle: MarketContextBundle, dna: FundManagerDna): number {
  const pos = bundle.existingPosition;
  if (!pos) return 1;
  const close = bundle.price.closeKVnd;
  const perShareR =
    pos.initialRiskPerShareKvnd && pos.initialRiskPerShareKvnd > 0
      ? pos.initialRiskPerShareKvnd
      : Math.max(pos.entryPriceKVnd - pos.stopLossKVnd, 0);
  const gainR = perShareR > 0 ? (close - pos.entryPriceKVnd) / perShareR : 0;
  const gainScore = clamp((gainR + 1) / 4, 0, 1); // -1R → 0, +3R → 1
  const retScore = clamp(((close - pos.entryPriceKVnd) / pos.entryPriceKVnd) * 5 + 0.5, 0, 1);
  const ageScore = clamp(1 - pos.holdingDays / dna.position.timeStop.maxHoldingDays, 0, 1);
  return 0.5 * gainScore + 0.3 * retScore + 0.2 * ageScore;
}

export interface RotationMeta {
  rotationGroupId: string;
  rotatedInSymbol: string;
  rotatedOutSymbol: string;
  opportunityScore: number;
  weakestHoldingScore: number;
  scoreGap: number;
}

export type RotationPlan =
  | { kind: "none" }
  | { kind: "blocked"; reason: string; candidateSymbol: string }
  | ({ kind: "rotate"; laggardAction: "REDUCE" | "EXIT"; items: { symbol: string; bundle: MarketContextBundle; decision: AgentDecisionOutput }[] } & RotationMeta);

interface EvalArgs {
  dna: FundManagerDna;
  state: ManagerStateSnapshot;
  sessionDate: string;
  bundles: MarketContextBundle[];
  rotationsToday: number;
}

function withCapacity(b: MarketContextBundle, openPositionCount: number, cashVnd: number): MarketContextBundle {
  return { ...b, portfolioState: { ...b.portfolioState, openPositionCount, cashVnd } };
}

function withRotation(d: AgentDecisionOutput, extraCodes: string[], meta: RotationMeta): AgentDecisionOutput {
  const md = d.metadata as unknown as Record<string, unknown>;
  return {
    ...d,
    reason_codes: [...extraCodes, ...(d.reason_codes ?? [])],
    supporting_signals: d.action === "BUY" ? [...extraCodes, ...d.supporting_signals] : d.supporting_signals,
    metadata: { ...md, ...meta } as unknown as AgentDecisionOutput["metadata"],
  };
}

export function evaluateRotation(args: EvalArgs): RotationPlan {
  const { dna, state, sessionDate, bundles, rotationsToday } = args;
  if (!dna.rotation.enabled) return { kind: "none" };

  const holdings = bundles.filter((b) => b.existingPosition);
  const candidates = bundles.filter((b) => !b.existingPosition);
  if (holdings.length === 0 || candidates.length === 0) return { kind: "none" };

  // Candidates the manager would buy if it had capacity (relax slots + cash).
  const HUGE = 1e15;
  const qualified = candidates
    .map((b) => {
      const relaxed = evaluateManager({ bundle: withCapacity(b, 0, HUGE), dna, state, sessionDate });
      return relaxed.action === "BUY" ? { bundle: b, score: opportunityScore(b, dna) } : null;
    })
    .filter((x): x is { bundle: MarketContextBundle; score: number } => x != null)
    .sort((a, b) => b.score - a.score || a.bundle.symbol.localeCompare(b.bundle.symbol));
  if (qualified.length === 0) return { kind: "none" };
  const best = qualified[0]!;

  // Provisional candidate size (relaxed capacity) — how much room/cash it needs.
  const provisional = evaluateManager({ bundle: withCapacity(best.bundle, 0, HUGE), dna, state, sessionDate });
  if (provisional.action !== "BUY") return { kind: "none" };
  const candidateSize = provisional.position_size_vnd ?? 0;

  const nav = best.bundle.portfolioState.navVnd;
  const cash = best.bundle.portfolioState.cashVnd;
  const invested = Math.max(0, nav - cash);
  const openCount = best.bundle.portfolioState.openPositionCount;
  const atMaxSlots = openCount >= dna.portfolio.maxConcurrentPositions;
  const exposureCap = nav * dna.portfolio.maxPortfolioExposurePct;
  const exposureBlocked = invested + candidateSize > exposureCap;
  const cashBlocked = candidateSize > cash;

  // Not constrained → the normal BUY path handles it; no rotation needed.
  if (!atMaxSlots && !exposureBlocked && !cashBlocked) return { kind: "none" };

  if (dna.rotation.requireCleanRegime && !regimeClean(best.bundle)) {
    return { kind: "blocked", reason: R.ROTATE_BLOCKED_REGIME, candidateSymbol: best.bundle.symbol };
  }

  const scored = holdings
    .map((b) => ({ bundle: b, score: weakestHoldingScore(b, dna) }))
    .sort((a, b) => a.score - b.score || a.bundle.symbol.localeCompare(b.bundle.symbol));
  const weakest = scored[0]!;

  const gap = best.score - weakest.score;
  if (gap < dna.rotation.threshold) {
    return { kind: "blocked", reason: R.ROTATE_THRESHOLD_NOT_MET, candidateSymbol: best.bundle.symbol };
  }
  if (rotationsToday >= dna.rotation.maxRotationsPerDay) {
    return { kind: "blocked", reason: R.ROTATE_CAP_REACHED, candidateSymbol: best.bundle.symbol };
  }

  // Decide REDUCE (partial funding suffices) vs EXIT (free a slot / full replacement).
  const wp = weakest.bundle.existingPosition!;
  const wClose = weakest.bundle.price.closeKVnd;
  const wValue = wp.quantity * wClose * 1000;
  const reduceQty = Math.floor((wp.quantity * dna.position.reduce.reduceFraction) / 100) * 100;
  const reduceValue = reduceQty * wClose * 1000;
  const roomNeeded = Math.max(0, invested + candidateSize - exposureCap);
  const cashNeeded = Math.max(0, candidateSize - cash);
  const reduceCovers = reduceQty >= 100 && reduceQty < wp.quantity && reduceValue >= roomNeeded && reduceValue >= cashNeeded;

  let laggardAction: "REDUCE" | "EXIT";
  if (atMaxSlots) laggardAction = "EXIT"; // must free a slot
  else if (dna.rotation.reduceVsExitBias > 0.5) laggardAction = "EXIT";
  else if (reduceCovers) laggardAction = "REDUCE";
  else laggardAction = "EXIT";

  const freed = laggardAction === "EXIT" ? wValue : reduceValue;
  const buyBundle = withCapacity(best.bundle, atMaxSlots ? openCount - 1 : openCount, cash + freed);
  const buyDecision = evaluateManager({ bundle: buyBundle, dna, state, sessionDate });
  if (buyDecision.action !== "BUY") return { kind: "none" }; // still cannot fund → abort

  const meta: RotationMeta = {
    rotationGroupId: deterministicUuid(`rot|${dna.slug}|${sessionDate}|${best.bundle.symbol}|${weakest.bundle.symbol}`),
    rotatedInSymbol: best.bundle.symbol,
    rotatedOutSymbol: weakest.bundle.symbol,
    opportunityScore: best.score,
    weakestHoldingScore: weakest.score,
    scoreGap: gap,
  };

  const laggardBase = evaluateManager({ bundle: weakest.bundle, dna, state, sessionDate });
  const laggardCode = laggardAction === "REDUCE" ? R.ROTATE_REDUCE_LAGGARD : R.ROTATE_EXIT_LAGGARD;
  const laggardDecision = withRotation(
    { ...laggardBase, action: laggardAction, reason_codes: [], quantity: laggardAction === "REDUCE" ? reduceQty : null },
    [laggardCode],
    meta
  );
  const buyOut = withRotation(buyDecision, [R.ROTATE_INTO_LEADER], meta);

  return {
    kind: "rotate",
    laggardAction,
    ...meta,
    items: [
      { symbol: weakest.bundle.symbol, bundle: weakest.bundle, decision: laggardDecision },
      { symbol: best.bundle.symbol, bundle: best.bundle, decision: buyOut },
    ],
  };
}
