import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import {
  buildExtendedLeaderSeries,
  buildFailedReclaimSeries,
  buildReclaimWinnerSeries,
  buildWeakVolumeFakeoutSeries,
  flatIndexBars,
  bar,
} from "./__fixtures__/bar-series";
import { evaluateEarlyEntrySession } from "./evaluate-early-entry";
import { isEarlyEntryV1Enabled } from "./feature-flag";
import { deriveEarlyEntryTradeState } from "./trade-state";

describe("early-entry evaluate-early-entry", () => {
  it("is disabled by default", () => {
    const prev = process.env.EARLY_ENTRY_V1_ENABLED;
    delete process.env.EARLY_ENTRY_V1_ENABLED;
    expect(isEarlyEntryV1Enabled()).toBe(false);
    if (prev !== undefined) process.env.EARLY_ENTRY_V1_ENABLED = prev;
  });

  it("walk-forward uses only bars through session (no future leak)", () => {
    const stock = buildReclaimWinnerSeries();
    const index = flatIndexBars(stock);
    const session = stock[stock.length - 1]!.date;
    const full = evaluateEarlyEntrySession({
      stockBars: stock,
      indexBars: index,
      sessionDate: session,
    });
    const truncated = stock.slice(0, stock.length - 5);
    const early = evaluateEarlyEntrySession({
      stockBars: truncated,
      indexBars: index.slice(0, truncated.length),
      sessionDate: truncated[truncated.length - 1]!.date,
    });
    expect(full?.metrics.sessionDate).not.toBe(early?.metrics.sessionDate);
    expect(full?.metrics.close).not.toBe(early?.metrics.close);
  });

  it("strong score with BAD_RR yields WATCH not PILOT_BUY", () => {
    const { state } = deriveEarlyEntryTradeState({
      reasonCodes: ["RECLAIM_MA20", "RECLAIM_MA50", "VOLUME_EXPANSION", "BAD_RR"],
      transitionReasonCodes: [],
      earlyReversalScore: 97,
      extensionRiskScore: 0,
      gate2Quality: "INVALID",
      metrics: { rs20SpreadPct: 3 } as import("./types").EarlyEntryBarMetrics,
      hadRecentPilotContext: false,
      structureBroken: false,
    });
    expect(state).toBe("WATCH");
  });

  it("extended leader blocked", () => {
    const stock = buildExtendedLeaderSeries();
    const index = flatIndexBars(stock);
    const result = evaluateEarlyEntrySession({
      stockBars: stock,
      indexBars: index,
      sessionDate: stock[stock.length - 1]!.date,
    });
    expect(result?.proposedTradeState).toBe("EXTENDED_DO_NOT_CHASE");
  });

  it("weak volume fakeout tends toward BLOCKED or WATCH", () => {
    const stock = buildWeakVolumeFakeoutSeries();
    const index = flatIndexBars(stock);
    const result = evaluateEarlyEntrySession({
      stockBars: stock,
      indexBars: index,
      sessionDate: stock[stock.length - 1]!.date,
    });
    expect(["BLOCKED", "WATCH"]).toContain(result?.proposedTradeState);
    expect(result?.reasonCodes).toContain("WEAK_VOLUME");
  });

  it("failed reclaim series does not produce PILOT_BUY on last bar", () => {
    const stock = buildFailedReclaimSeries();
    const index = flatIndexBars(stock);
    const result = evaluateEarlyEntrySession({
      stockBars: stock,
      indexBars: index,
      sessionDate: stock[stock.length - 1]!.date,
    });
    expect(result?.proposedTradeState).not.toBe("PILOT_BUY");
  });
});

describe("Gate 2 regression when early-entry flag off", () => {
  let prevFlag: string | undefined;

  beforeEach(() => {
    prevFlag = process.env.EARLY_ENTRY_V1_ENABLED;
    delete process.env.EARLY_ENTRY_V1_ENABLED;
  });

  afterEach(() => {
    if (prevFlag !== undefined) process.env.EARLY_ENTRY_V1_ENABLED = prevFlag;
    else delete process.env.EARLY_ENTRY_V1_ENABLED;
  });

  it("evaluateBreakoutPullbackCandidate unchanged by early-entry module", () => {
    const bars = buildReclaimWinnerSeries();
    const session = bars[bars.length - 1]!.date;
    const evOff = evaluateBreakoutPullbackCandidate(bars, session);
    process.env.EARLY_ENTRY_V1_ENABLED = "true";
    evaluateEarlyEntrySession({
      stockBars: bars,
      indexBars: flatIndexBars(bars),
      sessionDate: session,
    });
    delete process.env.EARLY_ENTRY_V1_ENABLED;
    const evOn = evaluateBreakoutPullbackCandidate(bars, session);
    expect(evOn.quality).toBe(evOff.quality);
    expect(evOn.terminalCode).toBe(evOff.terminalCode);
    expect(evOn.rankScore).toBe(evOff.rankScore);
  });
});

describe("real ACB fixture replay (when present)", () => {
  async function loadAcbFixture() {
    const { existsSync, readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const fixturePath = resolve(
      process.cwd(),
      "docs/quant-audit/fixtures/acb-replay-real.json"
    );
    if (!existsSync(fixturePath)) return null;

    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      stockBars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
      indexBars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
    };
    const toBars = fixture.stockBars.map((r) => bar(r.date, r.open, r.high, r.low, r.close, r.volume));
    const indexBars = fixture.indexBars.map((r) => bar(r.date, r.open, r.high, r.low, r.close, r.volume));
    return { toBars, indexBars };
  }

  it("loads extended ACB fixture if available", async () => {
    const data = await loadAcbFixture();
    if (!data) return;

    const apr8 = data.toBars.find((b) => b.date.toISOString().slice(0, 10) === "2026-04-08");
    if (!apr8) return;

    const result = evaluateEarlyEntrySession({
      stockBars: data.toBars,
      indexBars: data.indexBars,
      sessionDate: apr8.date,
    });
    expect(result).not.toBeNull();
    expect(result!.reasonCodes.length).toBeGreaterThan(0);
    if (result!.earlyReversalScore >= 55 && result!.reasonCodes.includes("BAD_RR")) {
      expect(result!.proposedTradeState).toBe("WATCH");
      expect(result!.proposedTradeState).not.toBe("PILOT_BUY");
    }
  });

  it("ACB 2026-04-08: strong score, PILOT_BUY once the stop is the tightest valid candidate", async () => {
    // Was WATCH/BAD_RR when selectStopLevel picked the widest candidate here
    // (a wider, less realistic stop inflates planned risk and tanks R:R).
    // With the tightest valid candidate (reclaim_candle_low, ~2.6% below
    // close — the low of the actual reclaim session, a real technical
    // level) the same real setup clears RR_ACCEPTABLE (~2.70) on its own
    // merits: RECLAIM_MA20/MA50 + POCKET_PIVOT + COMPRESSION_BREAKOUT all
    // still hold, so this is a corrected true-positive, not a regression.
    const data = await loadAcbFixture();
    if (!data) return;
    const session = data.toBars.find((b) => b.date.toISOString().slice(0, 10) === "2026-04-08");
    if (!session) return;

    const result = evaluateEarlyEntrySession({
      stockBars: data.toBars,
      indexBars: data.indexBars,
      sessionDate: session.date,
    });
    expect(result!.earlyReversalScore).toBeGreaterThanOrEqual(55);
    expect(result!.metrics.invalidLevelReason).toBe("reclaim_candle_low");
    expect(result!.metrics.riskRewardRatio).toBeGreaterThanOrEqual(2.0);
    expect(result!.proposedTradeState).toBe("PILOT_BUY");
    expect(result!.reasonCodes).toContain("RR_ACCEPTABLE");
    expect(result!.targetPrice).not.toBeNull();
    expect(result!.invalidLevelReason).not.toBeNull();
  });

  it("ACB 2026-05-14: PILOT_BUY when gates pass", async () => {
    const data = await loadAcbFixture();
    if (!data) return;
    const session = data.toBars.find((b) => b.date.toISOString().slice(0, 10) === "2026-05-14");
    if (!session) return;

    const result = evaluateEarlyEntrySession({
      stockBars: data.toBars,
      indexBars: data.indexBars,
      sessionDate: session.date,
    });
    expect(result!.proposedTradeState).toBe("PILOT_BUY");
    expect(result!.reasonCodes).toContain("RR_ACCEPTABLE");
  });

  it("ACB 2026-05-26: EXTENDED_DO_NOT_CHASE", async () => {
    const data = await loadAcbFixture();
    if (!data) return;
    const session = data.toBars.find((b) => b.date.toISOString().slice(0, 10) === "2026-05-26");
    if (!session) return;

    const result = evaluateEarlyEntrySession({
      stockBars: data.toBars,
      indexBars: data.indexBars,
      sessionDate: session.date,
    });
    expect(result!.proposedTradeState).toBe("EXTENDED_DO_NOT_CHASE");
  });
});
