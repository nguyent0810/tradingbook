import { describe, expect, it } from "vitest";
import {
  evaluateBreakoutPullbackCandidate,
  validateSwingTradeStructure,
} from "./breakout-pullback";
import { computeGate2RankBreakdown } from "./rank-components";
import {
  GATE2_MAX_BREAKOUT_EXTENSION_FRAC,
  GATE2_MAX_PULLBACK_DEPTH_FRAC,
  GATE2_MIN_RISK_TO_STOP_FRAC,
} from "./constants";
import type { Gate2BarInput } from "./types";

function bar(
  dayIndex: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): Gate2BarInput {
  const unixSec = 1_700_000_000 + dayIndex * 86_400;
  return { date: new Date(unixSec * 1000), open, high, low, close, volume };
}

const BASE = 200;
const V_BASE = 1_000_000;

/**
 * 70 bars; breakout at index 59 (within last 10 of L=69). Last 20 closes are tuned so
 * MA20 ≤ BASE (zone floor ≤ ceiling) while post-breakout closes stay ≥ breakout level.
 */
function baselineValidPath(volLast: number): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  const lastIdx = 69;
  for (let i = 0; i <= lastIdx; i++) {
    if (i < 59) {
      // Slightly below BASE so the 20-day MA at L stays ≤ BASE (avoids inverted pullback box).
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

describe("evaluateBreakoutPullbackCandidate", () => {
  it("returns INVALID when volume trend fails", () => {
    const path = baselineValidPath(500_000);
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.quality).toBe("INVALID");
    expect(res.reasons.some((r) => r.includes("Participation"))).toBe(true);
  });

  it("returns valid Tier B when conditions pass but not Tier A", () => {
    const path = baselineValidPath(1_200_000);
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.quality).not.toBe("INVALID");
    expect(res.rankScore).toBeGreaterThanOrEqual(0);
    expect(res.reasons.some((r) => r.includes("Tier B"))).toBe(true);
    expect(res.reasons.some((r) => r.includes("breakout level"))).toBe(true);
    expect(res.reasons.some((r) => r.includes("pullback"))).toBe(true);
    expect(res.reasons.some((r) => /stop/i.test(r))).toBe(true);
  });

  it("returns Tier A when liquidity checks pass", () => {
    const path = baselineValidPath(2_000_000);
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.quality).not.toBe("INVALID");
    expect(res.rankScore).toBeGreaterThanOrEqual(0);
    expect(res.reasons.some((r) => r.includes("Tier A"))).toBe(true);
  });

  it("attaches rankComponents that reconcile to rankScore without changing score", () => {
    const path = baselineValidPath(2_000_000);
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.rankComponents).toBeDefined();
    const parts = res.rankComponents!;
    const sum = parts.volumeTerm + parts.extensionTerm + parts.maDistanceTerm - parts.depthPenalty;
    expect(parts.rankScore).toBe(sum);
    expect(parts.rankScore).toBe(res.rankScore);
  });

  it("sets stable terminalCode on INVALID evaluations", () => {
    const path = baselineValidPath(500_000);
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.quality).toBe("INVALID");
    expect(res.terminalCode).toBe("volume_ratio");
  });

  it("returns INVALID when no clean breakout in recent window", () => {
    const flat: Gate2BarInput[] = [];
    for (let i = 0; i < 70; i++) {
      flat.push(bar(i, BASE, BASE, BASE - 0.5, BASE, V_BASE));
    }
    const res = evaluateBreakoutPullbackCandidate(flat, flat[flat.length - 1]!.date);
    expect(res.quality).toBe("INVALID");
    expect(res.reasons.some((r) => r.includes("breakout"))).toBe(true);
  });

  it("returns INVALID when digestion trend fails", () => {
    const path: Gate2BarInput[] = [];
    for (let i = 0; i < 70; i++) {
      if (i < 59) path.push(bar(i, BASE, BASE, BASE - 0.5, BASE, V_BASE));
      else if (i === 59) path.push(bar(i, BASE, BASE + 2, BASE, BASE + 1, V_BASE));
      else if (i === 60) path.push(bar(i, BASE + 1, BASE + 1, BASE + 0.4, BASE + 0.99, V_BASE));
      else if (i < 69) path.push(bar(i, BASE + 1, BASE + 1.01, BASE + 0.95, BASE + 1, V_BASE));
      else path.push(bar(i, BASE + 1, BASE + 1.02, BASE + 0.96, BASE + 1, 2_000_000));
    }
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.quality).toBe("INVALID");
    expect(res.reasons.some((r) => /digestion/i.test(r))).toBe(true);
  });

  it("returns INVALID when breakout extension exceeds cap", () => {
    const path = baselineValidPath(2_000_000);
    const last = path[path.length - 1]!;
    path[path.length - 1] = {
      ...last,
      close: BASE + 12,
      high: Math.max(last.high, BASE + 12),
    };
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.quality).toBe("INVALID");
    expect(
      res.reasons.some((r) =>
        r.includes((GATE2_MAX_BREAKOUT_EXTENSION_FRAC * 100).toFixed(0)),
      ),
    ).toBe(true);
  });

  it("returns INVALID when pullback depth exceeds cap", () => {
    const path = baselineValidPath(2_000_000);
    const deepIdx = 62;
    const b = path[deepIdx]!;
    path[deepIdx] = {
      ...b,
      low: BASE - 12,
      high: Math.max(b.high, b.close),
    };
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.quality).toBe("INVALID");
    expect(
      res.reasons.some((r) =>
        r.includes((GATE2_MAX_PULLBACK_DEPTH_FRAC * 100).toFixed(0)),
      ),
    ).toBe(true);
  });
});

describe("evaluateBreakoutPullbackCandidate — full-path terminalCode coverage", () => {
  it("insufficient_bars: fewer than 50 bars", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 40; i++) bars.push(bar(i, 100, 101, 99, 100, V_BASE));
    const res = evaluateBreakoutPullbackCandidate(bars, bars[bars.length - 1]!.date);
    expect(res.terminalCode).toBe("insufficient_bars");
  });

  it("stale_or_session_mismatch: expectedLatestSession does not match the latest bar", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 55; i++) bars.push(bar(i, 100, 101, 99, 100, V_BASE));
    const wrongSession = new Date(bars[bars.length - 1]!.date.getTime() + 86_400_000);
    const res = evaluateBreakoutPullbackCandidate(bars, wrongSession);
    expect(res.terminalCode).toBe("stale_or_session_mismatch");
  });

  it("ma_compute: NaN close breaks the MA20/MA50 computation", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 60; i++) bars.push(bar(i, 100, 101, 99, 100, V_BASE));
    bars[55] = { ...bars[55]!, close: NaN };
    const res = evaluateBreakoutPullbackCandidate(bars, bars[bars.length - 1]!.date);
    expect(res.terminalCode).toBe("ma_compute");
  });

  it("trend_below_ma50: close finishes below the 50-day average", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i < 69; i++) bars.push(bar(i, 100, 100, 99, 100, V_BASE));
    bars.push(bar(69, 100, 100, 89, 90, V_BASE));
    const res = evaluateBreakoutPullbackCandidate(bars, bars[bars.length - 1]!.date);
    expect(res.terminalCode).toBe("trend_below_ma50");
  });

  it("trend_ma20_below_ma50: close above MA50 but MA20 has not caught up", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i <= 19; i++) bars.push(bar(i, 100, 100, 99, 100, V_BASE));
    for (let i = 20; i <= 49; i++) bars.push(bar(i, 220, 221, 219, 220, V_BASE));
    for (let i = 50; i <= 68; i++) bars.push(bar(i, 190, 191, 189, 190, V_BASE));
    bars.push(bar(69, 210, 211, 209, 210, V_BASE));
    const res = evaluateBreakoutPullbackCandidate(bars, bars[bars.length - 1]!.date);
    expect(res.terminalCode).toBe("trend_ma20_below_ma50");
  });

  it("breakout_not_holding: a session after the breakout closes back under resistance", () => {
    const path = baselineValidPath(2_000_000);
    path[62] = { ...path[62]!, close: BASE - 1, low: BASE - 1.2 };
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.terminalCode).toBe("breakout_not_holding");
  });

  it("volume_median_bad: the 20-session volume window is unusable (zero median)", () => {
    const path = baselineValidPath(0);
    for (let i = 50; i <= 69; i++) path[i] = { ...path[i]!, volume: 0 };
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.terminalCode).toBe("volume_median_bad");
  });

  it("pullback_zone_interaction: today's bar never touches the pullback box", () => {
    const path = baselineValidPath(2_000_000);
    path[69] = { ...path[69]!, low: BASE + 10, close: BASE + 12, high: BASE + 13, open: BASE + 10 };
    const res = evaluateBreakoutPullbackCandidate(path, path[path.length - 1]!.date);
    expect(res.terminalCode).toBe("pullback_zone_interaction");
  });

  it("mid_pullback_below_ma50: a mid-pullback close dips under a MA50 still elevated by older history", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i <= 19; i++) bars.push(bar(i, 160, 161, 159, 160, V_BASE));
    for (let i = 20; i <= 58; i++) bars.push(bar(i, 100, 100, 99.5, 100, V_BASE));
    bars.push(bar(59, 100, 109, 99, 108, V_BASE));
    bars.push(bar(60, 108, 108, 104, 105, V_BASE)); // mid-pullback dip, below MA50 but >= breakoutLevel
    for (let i = 61; i <= 68; i++) bars.push(bar(i, 109, 110, 107, 109, V_BASE));
    bars.push(bar(69, 109, 111, 108, 110, 2_000_000));
    const res = evaluateBreakoutPullbackCandidate(bars, bars[bars.length - 1]!.date);
    expect(res.terminalCode).toBe("mid_pullback_below_ma50");
  });

  it("pullback_zone_two_closes: the last two sessions closed under the pullback zone floor", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i <= 58; i++) bars.push(bar(i, 100, 100, 99.5, 100, V_BASE));
    bars.push(bar(59, 100, 116, 100, 115, V_BASE));
    for (let i = 60; i <= 67; i++) bars.push(bar(i, 113, 114, 112, 113, V_BASE));
    bars.push(bar(68, 105, 106, 104, 105, V_BASE));
    bars.push(bar(69, 105, 106, 104, 105, 2_000_000));
    const res = evaluateBreakoutPullbackCandidate(bars, bars[bars.length - 1]!.date);
    expect(res.terminalCode).toBe("pullback_zone_two_closes");
  });

  it("swept_breakout_weak_close: a lower low than the breakout session plus a weak close vs MA20", () => {
    const bars: Gate2BarInput[] = [];
    for (let i = 0; i <= 58; i++) bars.push(bar(i, 100, 100, 99.5, 100, V_BASE));
    bars.push(bar(59, 100, 116, 99, 115, V_BASE));
    for (let i = 60; i <= 68; i++) bars.push(bar(i, 113, 114, 112, 113, V_BASE));
    bars.push(bar(69, 106, 107, 95, 104, 2_000_000));
    const res = evaluateBreakoutPullbackCandidate(bars, bars[bars.length - 1]!.date);
    expect(res.terminalCode).toBe("swept_breakout_weak_close");
  });
});

describe("validateSwingTradeStructure", () => {
  it("flags a malformed pullback zone (floor above ceiling)", () => {
    const msg = validateSwingTradeStructure({
      breakoutLevel: 100,
      pullbackZoneLow: 105,
      pullbackZoneHigh: 100,
      stopLevel: 90,
      close: 102,
    });
    expect(msg).toMatch(/malformed/i);
  });

  it("rejects stop at or above entry", () => {
    const msg = validateSwingTradeStructure({
      breakoutLevel: 100,
      pullbackZoneLow: 98,
      pullbackZoneHigh: 100,
      stopLevel: 104,
      close: 100,
    });
    expect(msg).toMatch(/at or above entry/i);
  });

  it("rejects risk to stop below minimum fraction", () => {
    const close = 100;
    const stop = close * (1 - GATE2_MIN_RISK_TO_STOP_FRAC / 2);
    const msg = validateSwingTradeStructure({
      breakoutLevel: 100,
      pullbackZoneLow: 98,
      pullbackZoneHigh: 100,
      stopLevel: stop,
      close,
    });
    expect(msg).toMatch(/below minimum|Entry→stop distance/i);
  });
});
