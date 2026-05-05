import { describe, expect, it } from "vitest";
import {
  evaluateBreakoutPullbackCandidate,
  validateSwingTradeStructure,
} from "./breakout-pullback";
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

describe("validateSwingTradeStructure", () => {
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
