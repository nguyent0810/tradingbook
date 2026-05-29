import { describe, expect, it } from "vitest";
import { evaluateBreakoutPullbackCandidate } from "./breakout-pullback";
import {
  gate2EvalParamsForSweep,
  GATE2_SWEEP_DIMENSIONS,
  PRODUCTION_GATE2_EVAL_PARAMS,
} from "./gate2-eval-params";
import {
  buildSweepArm,
  evaluateSymbolAtSession,
  qualityCounts,
  runThresholdSweep,
  terminalCodeCounts,
} from "./gate2-threshold-sweep";
import type { Gate2BarInput } from "./types";

function bar(dayIndex: number, open: number, high: number, low: number, close: number, volume: number): Gate2BarInput {
  const unixSec = 1_700_000_000 + dayIndex * 86_400;
  return { date: new Date(unixSec * 1000), open, high, low, close, volume };
}

const BASE = 200;
const V_BASE = 1_000_000;

function baselineValidPath(volLast: number): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  const lastIdx = 69;
  for (let i = 0; i <= lastIdx; i++) {
    if (i < 59) {
      out.push(bar(i, BASE, BASE, BASE - 1, BASE - 1, V_BASE));
    } else if (i === 59) {
      out.push(bar(i, BASE, BASE + 2, BASE, BASE + 1, V_BASE));
    } else if (i === 60) {
      out.push(bar(i, BASE + 1, BASE + 1, BASE - 3, BASE + 0.5, V_BASE));
    } else if (i < 68) {
      out.push(bar(i, BASE, BASE + 0.6, BASE - 0.2, BASE, V_BASE));
    } else if (i === 68) {
      out.push(bar(i, BASE, BASE + 0.6, BASE - 0.2, BASE + 0.5, V_BASE));
    } else {
      out.push(bar(i, BASE + 5, BASE + 7, BASE - 1, BASE + 6, volLast));
    }
  }
  return out;
}

describe("evaluateBreakoutPullbackCandidate — production default", () => {
  it("default params match explicit PRODUCTION_GATE2_EVAL_PARAMS", () => {
    const path = baselineValidPath(2_000_000);
    const session = path[path.length - 1]!.date;
    const implicit = evaluateBreakoutPullbackCandidate(path, session);
    const explicit = evaluateBreakoutPullbackCandidate(
      path,
      session,
      PRODUCTION_GATE2_EVAL_PARAMS
    );
    expect(explicit.quality).toBe(implicit.quality);
    expect(explicit.rankScore).toBe(implicit.rankScore);
    expect(explicit.terminalCode).toBe(implicit.terminalCode);
  });
});

describe("runThresholdSweep", () => {
  it("includes terminalCode distribution on baseline", () => {
    const path = baselineValidPath(2_000_000);
    const session = path[path.length - 1]!.date;
    const report = runThresholdSweep({
      asOfSession: session,
      symbols: [{ symbol: "FIXTURE", bars: path }],
    });
    expect(report.baseline.counts.A + report.baseline.counts.B).toBeGreaterThanOrEqual(0);
    expect(Object.keys(report.baseline.terminalCodeCounts).length).toBeGreaterThan(0);
    expect(report.arms.length).toBeGreaterThan(0);
  });

  it("loosening min volume ratio B passes when baseline fails volume_ratio only", () => {
    const path = baselineValidPath(1_000_000);
    const session = path[path.length - 1]!.date;
    const baseline = evaluateSymbolAtSession({
      symbol: "FIXTURE",
      bars: path,
      sessionDate: session,
    });
    expect(baseline.terminalCode).toBe("volume_ratio");
    const dim = GATE2_SWEEP_DIMENSIONS.find((d) => d.key === "minVolumeRatioB")!;
    const loose = evaluateSymbolAtSession({
      symbol: "FIXTURE",
      bars: path,
      sessionDate: session,
      evalParams: gate2EvalParamsForSweep(dim, 0.8),
    });
    expect(loose.quality === "A" || loose.quality === "B").toBe(true);
  });

  it("RS fields on snapshot do not change quality when only attached", () => {
    const path = baselineValidPath(2_000_000);
    const session = path[path.length - 1]!.date;
    const without = evaluateSymbolAtSession({
      symbol: "X",
      bars: path,
      sessionDate: session,
    });
    const withRs = evaluateSymbolAtSession({
      symbol: "X",
      bars: path,
      sessionDate: session,
      rsDiagnostic: {
        asOfDate: "2026-01-01",
        returns: [
          {
            lookbackSessions: 20,
            asOfDate: "2026-01-01",
            stockReturnPct: 5,
            indexReturnPct: 1,
            rsSpreadPct: 4,
          },
        ],
        stockAboveMa50: true,
        indexAboveMa50: true,
        stockLeadingMa50: false,
        dualUptrendMa50: true,
      },
    });
    expect(withRs.quality).toBe(without.quality);
    expect(withRs.rankScore).toBe(without.rankScore);
    expect(withRs.rs20SpreadPct).toBe(4);
  });

  it("anchor-only omits sessionDate and evaluates at asOf without stale mismatch", () => {
    const path = baselineValidPath(2_000_000);
    const session = path[path.length - 1]!.date;
    const report = runThresholdSweep({
      asOfSession: session,
      symbols: [{ symbol: "FIXTURE", bars: path }],
    });
    expect(report.replayMode).toBe(false);
    expect(report.staleSessionMismatchCount).toBe(0);
    expect(report.reportSchemaVersion).toBeTruthy();
  });

  it("walk-forward evaluates each row at its own sessionDate (not global anchor)", () => {
    const path = baselineValidPath(2_000_000);
    const earlySession = path[60]!.date;
    const lateSession = path[path.length - 1]!.date;
    const fixed = runThresholdSweep({
      asOfSession: lateSession,
      symbols: [
        { symbol: "X@early", bars: path.slice(0, 61), sessionDate: earlySession },
        { symbol: "Y", bars: path, sessionDate: lateSession },
      ],
    });
    expect(fixed.replayMode).toBe(true);
    expect(fixed.staleSessionMismatchCount).toBe(0);

    const buggy = runThresholdSweep({
      asOfSession: lateSession,
      symbols: [
        { symbol: "X@early", bars: path.slice(0, 61) },
        { symbol: "Y", bars: path },
      ],
    });
    expect(buggy.staleSessionMismatchCount).toBeGreaterThanOrEqual(1);
    expect(buggy.highStaleRateWarning).toMatch(/stale_or_session_mismatch/i);
  });

  it("buildSweepArm reports newly passing symbols", () => {
    const dim = GATE2_SWEEP_DIMENSIONS[0]!;
    const baseline = [
      {
        symbol: "A",
        sessionDate: "2026-01-01",
        quality: "INVALID" as const,
        rankScore: 0,
        terminalCode: "breakout_recency",
        rs20SpreadPct: null,
        rs50SpreadPct: null,
      },
    ];
    const variant = [
      {
        ...baseline[0]!,
        quality: "B" as const,
        terminalCode: "VALID",
        rankScore: 100,
      },
    ];
    const arm = buildSweepArm(dim, 1.2, baseline, variant);
    expect(arm.newlyPassingSymbols).toEqual(["A"]);
    expect(qualityCounts(variant).B).toBe(1);
    expect(terminalCodeCounts(variant).VALID).toBe(1);
  });
});
