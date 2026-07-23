import { describe, expect, it } from "vitest";
import type { BreakoutPullbackEvaluation } from "./types";
import type { RelativeStrengthDiagnostic } from "./relative-strength";
import { RS_LOOKBACK_20, RS_LOOKBACK_50 } from "./relative-strength";
import {
  buildRsNearMissWatchlistPanel,
  buildRsNearMissWatchlistRow,
  compareRsNearMissWatchlist,
  formatRsNearMissFailedGate2Because,
  isRsNearMissWatchlistEligible,
  isTierQuality,
  rsNearMissWatchlistActionHint,
  RS_NEAR_MISS_WATCHLIST_COPY,
  RS_NEAR_MISS_WATCHLIST_TITLE,
  sortRsNearMissWatchlist,
  type RsNearMissWatchlistRow,
} from "./rs-near-miss-watchlist";

function invalidEv(
  overrides: Partial<BreakoutPullbackEvaluation> = {}
): BreakoutPullbackEvaluation {
  return {
    quality: "INVALID",
    rankScore: 1200,
    breakoutLevel: 100,
    pullbackZoneLow: 95,
    pullbackZoneHigh: 98,
    stopLevel: 90,
    close: 99,
    reasons: ["Participation too thin vs median volume"],
    terminalCode: "volume_ratio",
    barDate: new Date("2026-05-28T00:00:00.000Z"),
    ...overrides,
  };
}

function rsDiag(rs20: number, rs50?: number): RelativeStrengthDiagnostic {
  const returns = [
    {
      lookbackSessions: RS_LOOKBACK_20,
      asOfDate: "2026-05-28",
      stockReturnPct: rs20 + 1,
      indexReturnPct: 1,
      rsSpreadPct: rs20,
    },
  ];
  if (rs50 != null) {
    returns.push({
      lookbackSessions: RS_LOOKBACK_50,
      asOfDate: "2026-05-28",
      stockReturnPct: rs50 + 1,
      indexReturnPct: 1,
      rsSpreadPct: rs50,
    });
  }
  return {
    asOfDate: "2026-05-28",
    returns,
    stockAboveMa50: true,
    indexAboveMa50: true,
    stockLeadingMa50: false,
    dualUptrendMa50: true,
  };
}

const bars = [
  {
    date: new Date("2026-05-28T00:00:00.000Z"),
    open: 98,
    high: 100,
    low: 97,
    close: 99,
    volume: 1_000_000,
  },
];

describe("rs-near-miss-watchlist", () => {
  it("includes INVALID RS20 positive with monitor terminal code", () => {
    expect(
      isRsNearMissWatchlistEligible({
        symbol: "HPG",
        ev: invalidEv({ terminalCode: "pullback_zone_interaction" }),
        rsDiagnostic: rsDiag(3.5),
      })
    ).toBe(true);
  });

  it("excludes INVALID RS20 negative or missing", () => {
    expect(
      isRsNearMissWatchlistEligible({
        symbol: "HPG",
        ev: invalidEv(),
        rsDiagnostic: rsDiag(-1),
      })
    ).toBe(false);
    expect(
      isRsNearMissWatchlistEligible({
        symbol: "HPG",
        ev: invalidEv(),
        rsDiagnostic: null,
      })
    ).toBe(false);
  });

  it("excludes Tier A/B quality", () => {
    expect(isTierQuality("A")).toBe(true);
    expect(isTierQuality("B")).toBe(true);
    expect(
      isRsNearMissWatchlistEligible({
        symbol: "HPG",
        ev: invalidEv({ quality: "A" }),
        rsDiagnostic: rsDiag(5),
      })
    ).toBe(false);
    expect(
      isRsNearMissWatchlistEligible({
        symbol: "HPG",
        ev: invalidEv(),
        rsDiagnostic: rsDiag(5),
        excludeSymbols: new Set(["HPG"]),
      })
    ).toBe(false);
  });

  it("excludes stale_or_session_mismatch and non-monitor terminals", () => {
    expect(
      isRsNearMissWatchlistEligible({
        symbol: "HPG",
        ev: invalidEv({ terminalCode: "stale_or_session_mismatch" }),
        rsDiagnostic: rsDiag(4),
      })
    ).toBe(false);
    expect(
      isRsNearMissWatchlistEligible({
        symbol: "HPG",
        ev: invalidEv({ terminalCode: "stop_structure" }),
        rsDiagnostic: rsDiag(4),
      })
    ).toBe(false);
  });

  it("sorts deterministically by RS20 then stageRank then distance", () => {
    const mk = (
      symbol: string,
      rs20: number,
      stageRank: number,
      dist: number | null
    ): RsNearMissWatchlistRow => ({
      symbol,
      sessionDate: "2026-05-28",
      rs20SpreadPct: rs20,
      rs50SpreadPct: null,
      terminalCode: "volume_ratio",
      terminalCategory: "volume_ratio",
      failedGate2Because: "x",
      topRejectionReason: "x",
      stageRank,
      distanceToPullbackZoneFrac: dist,
      rankScore: 0,
      lastVolume: 100,
      rsDiagnosticSummary: "RS20 +1",
    });

    const sorted = sortRsNearMissWatchlist([
      mk("BBB", 2, 70, 0.05),
      mk("AAA", 5, 50, 0.02),
      mk("CCC", 5, 72, 0.01),
    ]);

    expect(sorted.map((r) => r.symbol)).toEqual(["CCC", "AAA", "BBB"]);
    expect(compareRsNearMissWatchlist(sorted[0]!, sorted[1]!)).toBeLessThan(0);
  });

  it("panel copy stays non-actionable", () => {
    const row = buildRsNearMissWatchlistRow({
      symbol: "HPG",
      sessionDate: new Date("2026-05-28T00:00:00.000Z"),
      ev: invalidEv(),
      rsDiagnostic: rsDiag(2.1, 1.0),
      bars,
    });
    const panel = buildRsNearMissWatchlistPanel([row]);
    expect(panel.title).toBe(RS_NEAR_MISS_WATCHLIST_TITLE);
    expect(panel.disclaimerLines).toContain(RS_NEAR_MISS_WATCHLIST_COPY.diagnosticOnly);
    expect(panel.disclaimerLines).toContain(RS_NEAR_MISS_WATCHLIST_COPY.notSetupCandidate);
    expect(panel.actionHint).toMatch(/không dùng trong quyết định giao dịch hiện tại/i);
    expect(row.failedGate2Because).toMatch(/^Trượt Gate 2 vì:/);
    expect(formatRsNearMissFailedGate2Because("volume_ratio", "volume_ratio")).toMatch(
      /Trượt Gate 2 vì/
    );
    expect(rsNearMissWatchlistActionHint()).toMatch(/SetupCandidate/i);
  });
});
