/**
 * Phase 2 — Deterministic confidence model.
 *
 * Replaces the legacy constant 0.65. Confidence is a weighted blend of gate2
 * quality, relative strength, volume expansion, regime alignment, and
 * dual-uptrend, clamped to the manager's [floor, ceil]. Pure and deterministic.
 */
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import type { ConfidenceDna } from "@/lib/paper-lab/dna/fund-manager-dna";

export interface ConfidenceBasis {
  features: { gate2: number; rs: number; volume: number; regime: number; dual: number };
  score: number;
  confidence: number;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function trendAlignment(bundle: MarketContextBundle): number {
  const tr = bundle.marketRegime.regimeDimensions?.trendRegime;
  if (tr) {
    if (tr === "StrongBull" || tr === "WeakBull") return 1;
    if (tr === "Sideways") return 0.5;
    return 0;
  }
  const g = bundle.marketRegime.gate1Level;
  return g === "PASS" ? 1 : g === "WARNING" ? 0.5 : 0;
}

export function computeConfidenceBasis(bundle: MarketContextBundle, dna: ConfidenceDna): ConfidenceBasis {
  const quality = bundle.gate2Setup?.quality;
  const fGate2 = quality === "A" ? 1 : quality === "B" ? 0.6 : 0;

  const rs20 = bundle.relativeStrength?.returns.find((r) => r.lookbackSessions === 20)?.rsSpreadPct;
  const rs50 = bundle.relativeStrength?.returns.find((r) => r.lookbackSessions === 50)?.rsSpreadPct;
  const fRs =
    rs20 == null && rs50 == null ? 0 : clamp(((rs20 ?? 0) + (rs50 ?? 0)) / 2 / 10, 0, 1);

  const volRatio = bundle.volume.volRatioMa20;
  const fVol = volRatio == null ? 0 : clamp((volRatio - 1) / 1.5, 0, 1);

  const fRegime = (bundle.marketRegime.regimeConfidence ?? 0.5) * trendAlignment(bundle);
  const fDual = bundle.relativeStrength?.dualUptrendMa50 ? 1 : 0;

  const w = dna.weights;
  const score = w.gate2 * fGate2 + w.rs * fRs + w.volume * fVol + w.regime * fRegime + w.dual * fDual;
  const confidence = clamp(dna.floor + (dna.ceil - dna.floor) * score, dna.floor, dna.ceil);

  return { features: { gate2: fGate2, rs: fRs, volume: fVol, regime: fRegime, dual: fDual }, score, confidence };
}
