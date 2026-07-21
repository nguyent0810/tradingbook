import { describe, expect, it } from "vitest";
import {
  computeAtr14,
  distanceToZonePct,
  evaluateWatchHealth,
  filterBarsThroughEval,
} from "./evaluate-watch-health";
import type { OhlcvBar } from "./types";

function bar(
  isoDay: string,
  overrides: Partial<
    Pick<OhlcvBar, "open" | "high" | "low" | "close" | "volume">
  > = {}
): OhlcvBar {
  const base = {
    open: 100,
    high: 102,
    low: 98,
    close: 100,
    volume: 1_000_000,
  };
  return {
    date: new Date(`${isoDay}T12:00:00.000Z`),
    ...base,
    ...overrides,
  };
}

describe("distanceToZonePct", () => {
  it("returns 0 inside zone", () => {
    expect(distanceToZonePct(100, 98, 102)).toBe(0);
  });

  it("measures above zoneHigh vs zoneHigh", () => {
    expect(distanceToZonePct(110, 90, 100)).toBeCloseTo(0.1, 6);
  });

  it("measures below zoneLow vs zoneLow", () => {
    expect(distanceToZonePct(85, 90, 100)).toBeCloseTo((90 - 85) / 90, 6);
  });

  it("returns null (not 0) when zone data is invalid, instead of reading as perfectly centered", () => {
    expect(distanceToZonePct(100, 0, 100)).toBeNull();
    expect(distanceToZonePct(100, 100, 0)).toBeNull();
    expect(distanceToZonePct(100, -1, 100)).toBeNull();
  });
});

describe("extended tiers (mutually exclusive)", () => {
  const zoneHigh = 100;

  it("no flag at exactly 5% extension", () => {
    const close = 105;
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: zoneHigh,
      firstSeenBarDate: new Date("2026-01-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-01-02T12:00:00.000Z"),
      barsAscThroughEval: [
        bar("2026-01-01", { close: 104 }),
        bar("2026-01-02", { close }),
      ],
    });
    expect(r.flags.filter((f) => f === "EXTENDED" || f === "TOO_EXTENDED" || f === "CHASE")).toHaveLength(
      0
    );
  });

  it("EXTENDED when >5% and ≤8%", () => {
    const close = 106;
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: zoneHigh,
      firstSeenBarDate: new Date("2026-01-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-01-02T12:00:00.000Z"),
      barsAscThroughEval: [
        bar("2026-01-01", { close: 104 }),
        bar("2026-01-02", { close }),
      ],
    });
    expect(r.flags).toContain("EXTENDED");
    expect(r.flags).not.toContain("TOO_EXTENDED");
    expect(r.flags).not.toContain("CHASE");
  });

  it("TOO_EXTENDED when >8% and ≤12%", () => {
    const close = 109;
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: zoneHigh,
      firstSeenBarDate: new Date("2026-01-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-01-02T12:00:00.000Z"),
      barsAscThroughEval: [
        bar("2026-01-01", { close: 104 }),
        bar("2026-01-02", { close }),
      ],
    });
    expect(r.flags).toContain("TOO_EXTENDED");
    expect(r.flags).not.toContain("EXTENDED");
    expect(r.flags).not.toContain("CHASE");
  });

  it("CHASE when >12%", () => {
    const close = 113;
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: zoneHigh,
      firstSeenBarDate: new Date("2026-01-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-01-02T12:00:00.000Z"),
      barsAscThroughEval: [
        bar("2026-01-01", { close: 104 }),
        bar("2026-01-02", { close }),
      ],
    });
    expect(r.flags).toContain("CHASE");
    expect(r.flags.filter((f) => ["EXTENDED", "TOO_EXTENDED", "CHASE"].includes(f))).toHaveLength(1);
  });
});

describe("computeAtr14", () => {
  it("returns null with fewer than 15 bars", () => {
    const bars = Array.from({ length: 10 }, (_, i) =>
      bar(`2026-02-${String(i + 1).padStart(2, "0")}`)
    );
    expect(computeAtr14(bars)).toBeNull();
  });

  it("computes a positive ATR with 15+ bars of real range", () => {
    const bars = Array.from({ length: 15 }, (_, i) =>
      bar(`2026-02-${String(i + 1).padStart(2, "0")}`, { high: 102, low: 98, close: 100 })
    );
    expect(computeAtr14(bars)).toBeCloseTo(4, 6); // flat high-low=4 range every bar
  });
});

describe("volatility-normalized extension thresholds (ATR%)", () => {
  function quietBars(count: number, close: number): OhlcvBar[] {
    return Array.from({ length: count }, (_, i) =>
      bar(`2026-03-${String(i + 1).padStart(2, "0")}`, {
        high: close + 0.5,
        low: close - 0.5,
        close,
      })
    );
  }

  function volatileBars(count: number, close: number): OhlcvBar[] {
    return Array.from({ length: count }, (_, i) =>
      bar(`2026-03-${String(i + 1).padStart(2, "0")}`, {
        high: close + 10,
        low: close - 10,
        close,
      })
    );
  }

  it("provenance: falls back to flat % with too few bars for ATR", () => {
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: 100,
      firstSeenBarDate: new Date("2026-01-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-01-02T12:00:00.000Z"),
      barsAscThroughEval: [bar("2026-01-01", { close: 104 }), bar("2026-01-02", { close: 105 })],
    });
    expect(r.meta.extensionThresholdSource).toBe("flat_pct_fallback");
  });

  it("provenance: uses ATR-based thresholds once 15+ bars are available", () => {
    const bars = [...quietBars(14, 100), bar("2026-03-15", { close: 105, high: 105.5, low: 104.5 })];
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: 100,
      firstSeenBarDate: new Date("2026-03-01T12:00:00.000Z"),
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });
    expect(r.meta.extensionThresholdSource).toBe("atr");
  });

  it("a quiet (low-ATR%) stock is flagged more aggressively than the flat-% rule at the same raw extension", () => {
    // 5% above zoneHigh would be exactly the flat-threshold boundary (no flag).
    // For a stock whose normal daily range is ~1, 5% is a much bigger relative
    // move — ATR-normalized thresholds must flag it, not wave it through.
    const bars = [...quietBars(14, 100), bar("2026-03-15", { close: 105, high: 105.5, low: 104.5 })];
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: 100,
      firstSeenBarDate: new Date("2026-03-01T12:00:00.000Z"),
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });
    expect(r.meta.extensionThresholdSource).toBe("atr");
    expect(r.flags.some((f) => f === "EXTENDED" || f === "TOO_EXTENDED" || f === "CHASE")).toBe(true);
  });

  it("a volatile (high-ATR%) stock is NOT flagged at a raw extension that would trip the flat-% rule", () => {
    // 8% above zoneHigh would be TOO_EXTENDED under the flat rule. For a stock
    // whose normal daily range is ±10, 8% is well within its ordinary noise —
    // ATR-normalized thresholds must not chase-flag ordinary volatility.
    const bars = [...volatileBars(14, 100), bar("2026-03-15", { close: 108, high: 118, low: 98 })];
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: 100,
      firstSeenBarDate: new Date("2026-03-01T12:00:00.000Z"),
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });
    expect(r.meta.extensionThresholdSource).toBe("atr");
    expect(r.flags.some((f) => f === "EXTENDED" || f === "TOO_EXTENDED" || f === "CHASE")).toBe(false);
  });
});

describe("AGING_SETUP", () => {
  it("flags when ≥5 sessions strictly after firstSeen through eval", () => {
    const firstSeen = new Date("2026-01-01T12:00:00.000Z");
    const bars = [
      bar("2026-01-01", { close: 101 }),
      bar("2026-01-02", { close: 101 }),
      bar("2026-01-03", { close: 101 }),
      bar("2026-01-04", { close: 101 }),
      bar("2026-01-05", { close: 101 }),
      bar("2026-01-06", { close: 101 }),
    ];
    const r = evaluateWatchHealth({
      breakoutLevel: 95,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 99,
      firstSeenBarDate: firstSeen,
      evalBarDate: new Date("2026-01-06T12:00:00.000Z"),
      barsAscThroughEval: bars,
    });
    expect(r.flags).toContain("AGING_SETUP");
  });

  it("no flag with only 4 sessions after first seen", () => {
    const bars = [
      bar("2026-01-01", { close: 101 }),
      bar("2026-01-02", { close: 101 }),
      bar("2026-01-03", { close: 101 }),
      bar("2026-01-04", { close: 101 }),
      bar("2026-01-05", { close: 101 }),
    ];
    const r = evaluateWatchHealth({
      breakoutLevel: 95,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 99,
      firstSeenBarDate: new Date("2026-01-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-01-05T12:00:00.000Z"),
      barsAscThroughEval: bars,
    });
    expect(r.flags).not.toContain("AGING_SETUP");
  });
});

describe("VOLUME_FADE", () => {
  it("flags last 3 volumes strictly decreasing", () => {
    const bars: OhlcvBar[] = [];
    for (let d = 1; d <= 10; d++) {
      const day = `2026-01-${String(d).padStart(2, "0")}`;
      bars.push(bar(day, { close: 101, volume: 500_000 }));
    }
    bars[bars.length - 3]!.volume = 400_000;
    bars[bars.length - 2]!.volume = 300_000;
    bars[bars.length - 1]!.volume = 200_000;

    const r = evaluateWatchHealth({
      breakoutLevel: 95,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 99,
      firstSeenBarDate: bars[0]!.date,
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });
    expect(r.flags).toContain("VOLUME_FADE");
  });

  it("flags volume / median20 < 0.7", () => {
    const vols = Array.from({ length: 19 }, () => 1_000_000);
    vols.push(500_000);
    const bars: OhlcvBar[] = vols.map((volume, i) =>
      bar(`2026-01-${String(i + 1).padStart(2, "0")}`, { close: 101, volume })
    );
    bars.push(
      bar("2026-01-21", {
        close: 101,
        volume: 600_000,
      })
    );

    const r = evaluateWatchHealth({
      breakoutLevel: 95,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 99,
      firstSeenBarDate: bars[0]!.date,
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });
    expect(r.flags).toContain("VOLUME_FADE");
  });
});

describe("FAILED_TO_PULLBACK", () => {
  it("uses first breakout in full history and counts sessions after breakout bar", () => {
    const zoneLow = 94;
    const zoneHigh = 96;
    const breakoutLevel = 97;

    const bars: OhlcvBar[] = [];
    const mk = (day: number, close: number, high: number, low: number) =>
      bar(`2026-02-${String(day).padStart(2, "0")}`, { close, high, low });

    bars.push(mk(1, 96.5, 97.5, 96));
    bars.push(mk(2, 98, 99, 97.5));
    bars.push(mk(3, 98.5, 99, 97.8));
    bars.push(mk(4, 99, 99.5, 98));
    bars.push(mk(5, 99.2, 99.6, 98.5));
    bars.push(mk(6, 99.4, 99.8, 98.8));
    bars.push(mk(7, 99.5, 100, 99));

    const firstSeen = bars[3]!.date;

    const r = evaluateWatchHealth({
      breakoutLevel,
      pullbackZoneLow: zoneLow,
      pullbackZoneHigh: zoneHigh,
      firstSeenBarDate: firstSeen,
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });

    expect(r.meta.sessionsSinceBreakout).toBe(5);
    expect(r.flags).toContain("FAILED_TO_PULLBACK");
  });

  it("clears when price interacts pullback zone after breakout", () => {
    const zoneLow = 94;
    const zoneHigh = 96;
    const breakoutLevel = 97;

    const bars: OhlcvBar[] = [];
    const mk = (day: number, close: number, high: number, low: number) =>
      bar(`2026-03-${String(day).padStart(2, "0")}`, { close, high, low });

    bars.push(mk(1, 96.5, 97.5, 96));
    bars.push(mk(2, 98, 99, 97.5));
    bars.push(mk(3, 98.5, 99, 94.5));
    bars.push(mk(4, 99, 99.5, 98));
    bars.push(mk(5, 99.2, 99.6, 98.5));
    bars.push(mk(6, 99.4, 99.8, 98.8));
    bars.push(mk(7, 99.5, 100, 99));

    const r = evaluateWatchHealth({
      breakoutLevel,
      pullbackZoneLow: zoneLow,
      pullbackZoneHigh: zoneHigh,
      firstSeenBarDate: bars[0]!.date,
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });

    expect(r.flags).not.toContain("FAILED_TO_PULLBACK");
  });
});

describe("REVERSAL_RISK", () => {
  it("flags weak close in lower 30% of range with volume above median20", () => {
    const bars: OhlcvBar[] = [];
    for (let i = 0; i < 20; i++) {
      bars.push(
        bar(`2026-04-${String(i + 1).padStart(2, "0")}`, {
          close: 100 + i * 0.01,
          high: 101,
          low: 99,
          volume: 800_000,
        })
      );
    }
    bars.push(
      bar("2026-04-21", {
        open: 100,
        high: 110,
        low: 100,
        close: 101,
        volume: 900_000,
      })
    );

    const r = evaluateWatchHealth({
      breakoutLevel: 95,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 99,
      firstSeenBarDate: bars[0]!.date,
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });

    expect(r.flags).toContain("REVERSAL_RISK");
  });

  it("does not flag when high <= low (invalid range)", () => {
    const b = bar("2026-05-01", {
      high: 100,
      low: 100,
      close: 100,
      volume: 2_000_000,
    });
    const r = evaluateWatchHealth({
      breakoutLevel: 95,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 99,
      firstSeenBarDate: b.date,
      evalBarDate: b.date,
      barsAscThroughEval: [b],
    });
    expect(r.flags).not.toContain("REVERSAL_RISK");
  });
});

describe("DEAD_SETUP", () => {
  it("flags when distance to zone > 10%", () => {
    const r = evaluateWatchHealth({
      breakoutLevel: 80,
      pullbackZoneLow: 90,
      pullbackZoneHigh: 92,
      firstSeenBarDate: new Date("2026-06-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-06-02T12:00:00.000Z"),
      barsAscThroughEval: [
        bar("2026-06-01", { close: 110 }),
        bar("2026-06-02", { close: 110, high: 111, low: 109 }),
      ],
    });
    expect(distanceToZonePct(110, 90, 92)).toBeGreaterThan(0.1);
    expect(r.flags).toContain("DEAD_SETUP");
    expect(r.level).toBe("DEAD");
  });

  it("does not flag DEAD_SETUP from invalid zone data (null distance is unknown, not far)", () => {
    // Known, accepted limitation: invalid zone data no longer falsely triggers
    // DEAD_SETUP, but it also doesn't gain any other zone-derived flag — a setup
    // with corrupt zone data and no other issue can still read HEALTHY here.
    const r = evaluateWatchHealth({
      breakoutLevel: 80,
      pullbackZoneLow: 0,
      pullbackZoneHigh: 0,
      firstSeenBarDate: new Date("2026-06-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-06-02T12:00:00.000Z"),
      barsAscThroughEval: [
        bar("2026-06-01", { close: 110 }),
        bar("2026-06-02", { close: 110, high: 111, low: 109 }),
      ],
    });
    expect(r.flags).not.toContain("DEAD_SETUP");
    expect(r.meta.distanceToZonePct).toBeNull();
  });
});

describe("combined flags and score / level", () => {
  it("AT_RISK when two non-dead flags apply", () => {
    const bars: OhlcvBar[] = [];
    for (let d = 1; d <= 8; d++) {
      bars.push(
        bar(`2026-07-${String(d).padStart(2, "0")}`, {
          close: 103,
          volume: 400_000 - d * 10_000,
        })
      );
    }
    bars[bars.length - 3]!.volume = 310_000;
    bars[bars.length - 2]!.volume = 210_000;
    bars[bars.length - 1]!.volume = 110_000;

    const r = evaluateWatchHealth({
      breakoutLevel: 99,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 98,
      firstSeenBarDate: bars[0]!.date,
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });

    expect(r.flags).toContain("AGING_SETUP");
    expect(r.flags).toContain("EXTENDED");
    expect(r.level).toBe("AT_RISK");
    expect(r.score).toBeLessThan(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("a single severe flag (REVERSAL_RISK, penalty 40) alone stays WARNING at the boundary", () => {
    const bars: OhlcvBar[] = [];
    for (let i = 1; i <= 9; i++) {
      bars.push(bar(`2026-09-${String(i).padStart(2, "0")}`, { close: 100, high: 101, low: 99, volume: 500_000 }));
    }
    bars.push(bar("2026-09-10", { open: 100, high: 110, low: 100, close: 101, volume: 600_000 }));

    const r = evaluateWatchHealth({
      breakoutLevel: 1000, // never crossed — keeps FAILED_TO_PULLBACK out of play
      pullbackZoneLow: 90,
      pullbackZoneHigh: 105, // contains close — keeps EXTENDED/DEAD_SETUP out of play
      firstSeenBarDate: bars[bars.length - 1]!.date, // same as evalBarDate — keeps AGING_SETUP out of play
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });

    expect(r.flags).toEqual(["REVERSAL_RISK"]);
    expect(r.level).toBe("WARNING");
  });

  it("two mild flags whose combined penalty exceeds the worst single flag become AT_RISK", () => {
    const bars: OhlcvBar[] = [];
    for (let i = 1; i <= 7; i++) {
      bars.push(bar(`2026-09-${String(i).padStart(2, "0")}`, { close: 100, high: 100.5, low: 99.5, volume: 500_000 }));
    }
    bars.push(bar("2026-09-08", { close: 100, high: 100.5, low: 99.5, volume: 390_000 }));
    bars.push(bar("2026-09-09", { close: 100, high: 100.5, low: 99.5, volume: 290_000 }));
    bars.push(bar("2026-09-10", { open: 105, high: 107, low: 105, close: 106, volume: 190_000 }));

    const r = evaluateWatchHealth({
      breakoutLevel: 1000,
      pullbackZoneLow: 94,
      pullbackZoneHigh: 100, // close (106) is ~6% above — EXTENDED via the flat-pct fallback (< 15 bars for ATR)
      firstSeenBarDate: bars[bars.length - 1]!.date,
      evalBarDate: bars[bars.length - 1]!.date,
      barsAscThroughEval: bars,
    });

    expect(r.flags).toContain("EXTENDED");
    expect(r.flags).toContain("VOLUME_FADE");
    expect(r.flags).not.toContain("REVERSAL_RISK");
    expect(r.level).toBe("AT_RISK"); // 25+25=50 > 40 (REVERSAL_RISK's penalty, the old count-based system's implicit ceiling)
  });

  it("CHASE forces DEAD level even with other flags", () => {
    const r = evaluateWatchHealth({
      breakoutLevel: 90,
      pullbackZoneLow: 94,
      pullbackZoneHigh: 100,
      firstSeenBarDate: new Date("2026-08-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-08-02T12:00:00.000Z"),
      barsAscThroughEval: [
        bar("2026-08-01", { close: 104 }),
        bar("2026-08-02", { close: 115 }),
      ],
    });
    expect(r.flags).toContain("CHASE");
    expect(r.level).toBe("DEAD");
  });

  it("missing eval bar returns NO_DATA, never HEALTHY/100 (regression: previously defaulted to a fake-healthy 100)", () => {
    const r = evaluateWatchHealth({
      breakoutLevel: 99,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 98,
      firstSeenBarDate: new Date("2026-08-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-08-10T12:00:00.000Z"),
      barsAscThroughEval: [], // no bars at all through the eval date
    });
    expect(r.level).toBe("NO_DATA");
    expect(r.level).not.toBe("HEALTHY");
    expect(r.score).toBe(0);
    expect(r.flags).toEqual([]);
  });

  it("missing eval bar also returns NO_DATA when all bars are strictly after the eval date", () => {
    const r = evaluateWatchHealth({
      breakoutLevel: 99,
      pullbackZoneLow: 96,
      pullbackZoneHigh: 98,
      firstSeenBarDate: new Date("2026-08-01T12:00:00.000Z"),
      evalBarDate: new Date("2026-08-01T12:00:00.000Z"),
      barsAscThroughEval: [bar("2026-08-05", { close: 100 })],
    });
    expect(r.level).toBe("NO_DATA");
    expect(r.score).toBe(0);
  });
});

describe("filterBarsThroughEval", () => {
  it("drops future bars and sorts ascending", () => {
    const bars = [
      bar("2026-09-03", { close: 100 }),
      bar("2026-09-01", { close: 99 }),
      bar("2026-09-05", { close: 102 }),
    ];
    const out = filterBarsThroughEval(bars, new Date("2026-09-03T12:00:00.000Z"));
    expect(out.map((b) => b.close)).toEqual([99, 100]);
  });
});
