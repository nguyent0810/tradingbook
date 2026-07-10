/**
 * Phase 1 — DNA validation helpers.
 *
 * Pure, deterministic checks that a FundManagerDna config stays within platform
 * caps and internal consistency. No behavior; used by tests and (later) a
 * config-load guard.
 */
import {
  PAPER_MAX_PORTFOLIO_EXPOSURE_PCT,
  PAPER_MAX_PER_TRADE_EXPOSURE_PCT,
  PAPER_MAX_NEW_POSITIONS_PER_DAY,
} from "@/lib/paper-lab/constants";
import { isKnownReasonCode } from "@/lib/paper-lab/contracts/reason-codes";
import { AGENT_DNA, MANAGER_SLUGS } from "@/lib/paper-lab/dna/manager-configs";
import type { FundManagerDna } from "@/lib/paper-lab/dna/fund-manager-dna";

export interface DnaViolation {
  slug: string;
  field: string;
  message: string;
}

/** Absolute sanity ceiling on per-trade risk fraction (well above any config). */
const MAX_BASE_RISK_PCT = 0.02;
const WEIGHT_SUM_TOLERANCE = 1e-9;

function inUnit(x: number): boolean {
  return x >= 0 && x <= 1;
}

export function findDnaViolations(dna: FundManagerDna): DnaViolation[] {
  const v: DnaViolation[] = [];
  const add = (field: string, message: string) => v.push({ slug: dna.slug, field, message });

  const p = dna.portfolio;
  if (p.maxPortfolioExposurePct > PAPER_MAX_PORTFOLIO_EXPOSURE_PCT) {
    add("portfolio.maxPortfolioExposurePct", `exceeds platform cap ${PAPER_MAX_PORTFOLIO_EXPOSURE_PCT}`);
  }
  if (p.maxPerSymbolPct > PAPER_MAX_PORTFOLIO_EXPOSURE_PCT) {
    add("portfolio.maxPerSymbolPct", "exceeds portfolio exposure cap");
  }
  if (p.maxPerSymbolPct > p.maxPortfolioExposurePct) {
    add("portfolio.maxPerSymbolPct", "greater than this manager's maxPortfolioExposurePct");
  }
  if (p.maxNewEntriesPerDay > PAPER_MAX_NEW_POSITIONS_PER_DAY) {
    add("portfolio.maxNewEntriesPerDay", `exceeds platform cap ${PAPER_MAX_NEW_POSITIONS_PER_DAY}`);
  }
  if (p.maxConcurrentPositions <= 0) add("portfolio.maxConcurrentPositions", "must be > 0");
  if (!(p.baseCashReservePct >= 0 && p.baseCashReservePct < 1)) {
    add("portfolio.baseCashReservePct", "must be in [0, 1)");
  }
  for (const [k, scale] of Object.entries(p.riskOnRiskOff.exposureScaleByTrend)) {
    if (!inUnit(scale)) add(`portfolio.exposureScaleByTrend.${k}`, "must be in [0, 1]");
  }

  const pos = dna.position;
  const baseRisk = pos.sizing.baseRiskPctOfNav;
  if (!(baseRisk > 0 && baseRisk <= MAX_BASE_RISK_PCT)) {
    add("position.sizing.baseRiskPctOfNav", `must be in (0, ${MAX_BASE_RISK_PCT}]`);
  }
  if (baseRisk > PAPER_MAX_PER_TRADE_EXPOSURE_PCT) {
    add("position.sizing.baseRiskPctOfNav", "exceeds per-trade exposure cap");
  }
  if (pos.add.enabled && pos.add.addRiskPctOfNav > baseRisk) {
    add("position.add.addRiskPctOfNav", "add risk should not exceed base risk");
  }
  if (pos.reduce.enabled && !(pos.reduce.reduceFraction > 0 && pos.reduce.reduceFraction <= 1)) {
    add("position.reduce.reduceFraction", "must be in (0, 1]");
  }
  if (pos.timeStop.maxHoldingDays <= 0) add("position.timeStop.maxHoldingDays", "must be > 0");

  const c = dna.confidence;
  const sum = c.weights.gate2 + c.weights.rs + c.weights.volume + c.weights.regime + c.weights.dual;
  if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) add("confidence.weights", `must sum to 1 (got ${sum})`);
  if (!(inUnit(c.floor) && inUnit(c.ceil) && c.floor <= c.ceil)) {
    add("confidence.floor/ceil", "must be in [0, 1] with floor <= ceil");
  }

  const ps = dna.psychology;
  for (const key of ["aggressiveness", "patience", "lossTolerance"] as const) {
    if (!inUnit(ps[key])) add(`psychology.${key}`, "must be in [0, 1]");
  }
  if (ps.drawdownResponse.haltNewAtDdPct < ps.drawdownResponse.deRiskAtDdPct) {
    add("psychology.drawdownResponse", "haltNewAtDdPct must be >= deRiskAtDdPct");
  }

  for (const code of dna.strategy.reasonCodes) {
    if (!isKnownReasonCode(code)) add("strategy.reasonCodes", `unknown reason code: ${code}`);
  }

  return v;
}

/** Validate every registered manager config. Empty array = all valid. */
export function validateAllDna(): DnaViolation[] {
  const out: DnaViolation[] = [];
  for (const slug of MANAGER_SLUGS) out.push(...findDnaViolations(AGENT_DNA[slug]));
  return out;
}

export function assertAllDnaValid(): void {
  const violations = validateAllDna();
  if (violations.length > 0) {
    const msg = violations.map((x) => `${x.slug}.${x.field}: ${x.message}`).join("\n");
    throw new Error(`Invalid fund-manager DNA:\n${msg}`);
  }
}
