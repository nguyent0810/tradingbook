import { describe, expect, it } from "vitest";
import {
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
