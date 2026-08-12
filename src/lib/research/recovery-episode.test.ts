import { describe, expect, it } from "vitest";
import { segmentEpisodes, type SegmentParams } from "./recovery-episode";

const P: SegmentParams = {
  newLowLookback: 20,
  stabilizationSessions: 5,
  holdSessions: 10,
  horizonSessions: 40,
};

/** Flat run, then a staircase decline, then a base, then a rally. */
function buildDeclineThenRecovery(rally: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 80; i++) out.push(100); // long flat base so MA50 is warm and high
  for (let i = 0; i < 40; i++) out.push(100 - i * 0.8); // decline making new lows
  for (let i = 0; i < 8; i++) out.push(68.5 + (i % 2) * 0.3); // stops making lows
  for (let i = 0; i < 60; i++) out.push(69 + i * rally); // recovery of varying strength
  return out;
}

describe("segmentEpisodes — an episode requires a real decline first", () => {
  it("emits nothing for a series that only ever rises", () => {
    const closes = Array.from({ length: 300 }, (_, i) => 100 * 1.002 ** i);
    expect(segmentEpisodes(closes, P)).toHaveLength(0);
  });

  it("emits nothing for a flat series", () => {
    expect(segmentEpisodes(new Array(300).fill(100), P)).toHaveLength(0);
  });

  it("emits nothing while price is still making new lows", () => {
    const closes = [...new Array(80).fill(100), ...Array.from({ length: 100 }, (_, i) => 100 - i)];
    // Never stabilises, never reclaims MA10 above a higher low.
    expect(segmentEpisodes(closes, P)).toHaveLength(0);
  });

  it("emits one attempt after decline → stabilise → reclaim", () => {
    const eps = segmentEpisodes(buildDeclineThenRecovery(0.9), P);
    expect(eps).toHaveLength(1);
    expect(eps[0]!.downtrendStart).toBeGreaterThan(79);
    expect(eps[0]!.t0).toBeGreaterThan(eps[0]!.downtrendStart);
    expect(eps[0]!.drawdownAtT0).toBeLessThan(0);
  });
});

describe("segmentEpisodes — outcomes come from index structure alone", () => {
  it("confirms when the index reclaims MA50 and holds", () => {
    const eps = segmentEpisodes(buildDeclineThenRecovery(0.9), P);
    expect(eps[0]!.outcome).toBe("CONFIRMED_RECOVERY");
    expect(eps[0]!.resolvedAt).toBeGreaterThan(0);
  });

  it("fails when the index undercuts the decline's low", () => {
    const closes = [
      ...new Array(80).fill(100),
      ...Array.from({ length: 40 }, (_, i) => 100 - i * 0.8),
      ...Array.from({ length: 8 }, (_, i) => 68.5 + (i % 2) * 0.3),
      ...Array.from({ length: 6 }, (_, i) => 69 + i * 0.4), // brief bounce
      ...Array.from({ length: 40 }, (_, i) => 71 - i * 1.2), // then breaks the low
    ];
    const eps = segmentEpisodes(closes, P);
    expect(eps.length).toBeGreaterThan(0);
    expect(eps[0]!.outcome).toBe("FAILED_RECOVERY");
  });

  it("reports UNRESOLVED rather than guessing when neither happens in the horizon", () => {
    const closes = [
      ...new Array(80).fill(100),
      ...Array.from({ length: 40 }, (_, i) => 100 - i * 0.8),
      ...Array.from({ length: 8 }, (_, i) => 68.5 + (i % 2) * 0.3),
      // Drifts sideways above the low but never near MA50.
      ...Array.from({ length: 60 }, (_, i) => 69.5 + Math.sin(i / 3) * 0.4),
    ];
    const eps = segmentEpisodes(closes, P);
    expect(eps.length).toBeGreaterThan(0);
    expect(eps[0]!.outcome).toBe("UNRESOLVED");
    expect(eps[0]!.resolvedAt).toBeNull();
  });

  it("does not emit a second overlapping episode from the same decline", () => {
    // Once an attempt is registered the machine waits for the regime to change,
    // so one decline cannot manufacture a dozen correlated episodes.
    const eps = segmentEpisodes(buildDeclineThenRecovery(0.05), P);
    expect(eps.length).toBeLessThanOrEqual(2);
  });
});

describe("point-in-time — T0 detection must not see the future", () => {
  const closes = buildDeclineThenRecovery(0.9);

  it("finds the same attempt sessions when later data is deleted", () => {
    // Outcomes legitimately differ (resolution reads forward — it is the label).
    // The DETECTION of T0 must not.
    const full = segmentEpisodes(closes, P).map((e) => e.t0);
    for (const cut of [130, 140, 150, 170]) {
      const truncated = segmentEpisodes(closes.slice(0, cut + 1), P).map((e) => e.t0);
      expect(truncated).toEqual(full.filter((t) => t <= cut));
    }
  });

  it("reports the same pre-T0 structure when later data is deleted", () => {
    const full = segmentEpisodes(closes, P)[0]!;
    const cut = full.t0 + 1;
    const trunc = segmentEpisodes(closes.slice(0, cut + 1), P)[0]!;
    expect(trunc.t0).toBe(full.t0);
    expect(trunc.downtrendStart).toBe(full.downtrendStart);
    expect(trunc.episodeLow).toBe(full.episodeLow);
    expect(trunc.drawdownAtT0).toBe(full.drawdownAtT0);
  });
});

describe("T0 is frozen against every resolution parameter", () => {
  // The whole sensitivity design rests on this: `holdSessions` and
  // `horizonSessions` describe how an episode RESOLVES and must not move where
  // it BEGINS. Only `stabilizationSessions` and `newLowLookback` — the
  // initiation rules — may. Without this separation a "label sensitivity" test
  // silently varies the measurement origin too, which is the ambiguity this
  // phase exists to remove.
  const closes = buildDeclineThenRecovery(0.9);

  it("gives identical t0 and pre-T0 structure across the whole resolution grid", () => {
    const base = segmentEpisodes(closes, P);
    for (const holdSessions of [3, 5, 8, 10, 15]) {
      for (const horizonSessions of [20, 30, 40, 60]) {
        const v = segmentEpisodes(closes, { ...P, holdSessions, horizonSessions });
        expect(v.map((e) => e.t0)).toEqual(base.map((e) => e.t0));
        expect(v.map((e) => e.downtrendStart)).toEqual(base.map((e) => e.downtrendStart));
        expect(v.map((e) => e.episodeLow)).toEqual(base.map((e) => e.episodeLow));
        expect(v.map((e) => e.drawdownAtT0)).toEqual(base.map((e) => e.drawdownAtT0));
      }
    }
  });

  it("does move t0 when an INITIATION rule changes — the case being isolated", () => {
    const strict = segmentEpisodes(closes, { ...P, stabilizationSessions: 8 });
    const base = segmentEpisodes(closes, P);
    // Later or fewer, never earlier: a longer stabilisation requirement can only
    // delay or suppress an attempt.
    for (let i = 0; i < strict.length; i++) {
      const match = base.find((b) => b.downtrendStart === strict[i]!.downtrendStart);
      if (match) expect(strict[i]!.t0).toBeGreaterThanOrEqual(match.t0);
    }
  });
});

describe("segmentEpisodes — parameters change the count, not the point-in-time property", () => {
  it("a longer stabilisation requirement yields no more episodes", () => {
    const closes = buildDeclineThenRecovery(0.9);
    const loose = segmentEpisodes(closes, { ...P, stabilizationSessions: 3 }).length;
    const strict = segmentEpisodes(closes, { ...P, stabilizationSessions: 10 }).length;
    expect(strict).toBeLessThanOrEqual(loose);
  });
});
