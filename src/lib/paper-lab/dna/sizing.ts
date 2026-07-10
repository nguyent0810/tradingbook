/**
 * Phase 2 — Risk-based position sizing.
 *
 * Deterministic. Replaces the legacy flat 50M notional. Size = risk budget ÷
 * per-share risk, capped by per-symbol exposure and available cash, rounded down
 * to the VN board lot. Returns null when geometry is invalid or below one lot.
 */
import {
  PAPER_DEFAULT_FEE_BPS,
  PAPER_MAX_PER_TRADE_EXPOSURE_PCT,
} from "@/lib/paper-lab/constants";
import { computeNotionalVnd, computeRiskAtStopVnd } from "@/lib/paper-lab/engine/units";
import { roundDownToBoardLotShares } from "@/lib/paper-lab/engine/board-lot";
import type { FundManagerDna } from "@/lib/paper-lab/dna/fund-manager-dna";

export interface SizingBasis {
  baseRiskPct: number;
  psychMod: number;
  effectiveRiskPct: number;
  perShareRiskKVnd: number;
  quantity: number;
  positionSizeVnd: number;
  riskAmountVnd: number;
  cappedBy: "risk" | "exposure" | "cash";
}

export interface SizingInput {
  navVnd: number;
  cashVnd: number;
  entryKVnd: number;
  stopKVnd: number;
  dna: FundManagerDna;
  psychMod: number;
  feeBps?: number;
  /** Override the base risk fraction (e.g. add.addRiskPctOfNav for pyramiding). */
  riskPctOfNavOverride?: number;
}

export function computeManagerPositionSize(input: SizingInput): SizingBasis | null {
  const { navVnd, cashVnd, entryKVnd, stopKVnd, dna, psychMod } = input;
  const feeBps = input.feeBps ?? PAPER_DEFAULT_FEE_BPS;

  const perShareRiskKVnd = entryKVnd - stopKVnd;
  if (!(perShareRiskKVnd > 0) || !(entryKVnd > 0)) return null; // invalid geometry

  const baseRiskPct = input.riskPctOfNavOverride ?? dna.position.sizing.baseRiskPctOfNav;
  const effectiveRiskPct = baseRiskPct * psychMod;
  const riskBudgetVnd = navVnd * effectiveRiskPct;

  const sharesByRisk = Math.floor(riskBudgetVnd / (perShareRiskKVnd * 1000));

  const perSymbolCapPct = Math.min(dna.portfolio.maxPerSymbolPct, PAPER_MAX_PER_TRADE_EXPOSURE_PCT);
  const sharesByExposure = Math.floor((navVnd * perSymbolCapPct) / (entryKVnd * 1000));

  const cashCapVnd = cashVnd * (1 - feeBps / 10_000);
  const sharesByCash = Math.floor(cashCapVnd / (entryKVnd * 1000));

  const target = Math.min(sharesByRisk, sharesByExposure, sharesByCash);
  const lot = roundDownToBoardLotShares(target);
  if (!lot.ok) return null; // below one board lot

  const cappedBy: SizingBasis["cappedBy"] =
    target === sharesByRisk ? "risk" : target === sharesByExposure ? "exposure" : "cash";

  return {
    baseRiskPct,
    psychMod,
    effectiveRiskPct,
    perShareRiskKVnd,
    quantity: lot.quantity,
    positionSizeVnd: computeNotionalVnd(entryKVnd, lot.quantity),
    riskAmountVnd: computeRiskAtStopVnd(entryKVnd, stopKVnd, lot.quantity),
    cappedBy,
  };
}
