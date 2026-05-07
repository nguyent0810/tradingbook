import { describe, expect, it } from "vitest";
import {
  buildActiveTacticalSymbolWhere,
  computeEffectiveScanUniverse,
  isTacticalSymbolActiveNow,
  normalizeTacticalSymbolInput,
} from "./tactical-universe";

describe("normalizeTacticalSymbolInput", () => {
  it("trims and uppercases ticker text", () => {
    expect(normalizeTacticalSymbolInput("  gEx ")).toBe("GEX");
  });

  it("throws when symbol is empty after trim", () => {
    expect(() => normalizeTacticalSymbolInput("   ")).toThrow(
      "Tactical symbol is required."
    );
  });
});

describe("isTacticalSymbolActiveNow", () => {
  const now = new Date("2026-05-07T00:00:00.000Z");

  it("is active only when ACTIVE + scanner flag true + not expired", () => {
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "ACTIVE",
          activeForScanner: true,
          expiresAt: new Date("2026-05-08T00:00:00.000Z"),
        },
        now
      )
    ).toBe(true);
  });

  it("returns false for expired row", () => {
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "ACTIVE",
          activeForScanner: true,
          expiresAt: new Date("2026-05-06T23:59:59.999Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("returns false for EXPIRED/REMOVED regardless of expiration time", () => {
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "EXPIRED",
          activeForScanner: true,
          expiresAt: new Date("2026-05-09T00:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "REMOVED",
          activeForScanner: true,
          expiresAt: new Date("2026-05-09T00:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
  });
});

describe("buildActiveTacticalSymbolWhere", () => {
  it("builds status+scanner+expiry filter", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");
    expect(buildActiveTacticalSymbolWhere(now)).toEqual({
      status: "ACTIVE",
      activeForScanner: true,
      expiresAt: { gt: now },
    });
  });
});

describe("computeEffectiveScanUniverse", () => {
  it("returns core-only universe when no tactical rows", () => {
    const r = computeEffectiveScanUniverse({
      coreRows: [
        { id: "s1", symbol: "AAA" },
        { id: "s2", symbol: "BBB" },
      ],
      tacticalRows: [],
    });
    expect(r.symbols).toEqual([
      { symbolId: "s1", symbol: "AAA", universeSource: "CORE" },
      { symbolId: "s2", symbol: "BBB", universeSource: "CORE" },
    ]);
    expect(r.stats).toMatchObject({
      coreCount: 2,
      tacticalCount: 0,
      overlapCount: 0,
      effectiveCount: 2,
      tacticalMissingStockSymbolCount: 0,
    });
  });

  it("includes tactical-only symbols and marks source TACTICAL", () => {
    const r = computeEffectiveScanUniverse({
      coreRows: [{ id: "s1", symbol: "AAA" }],
      tacticalRows: [
        {
          tacticalId: "t1",
          tacticalSymbol: " gex ",
          stockSymbolId: "s9",
        },
      ],
    });
    expect(r.symbols).toEqual([
      { symbolId: "s1", symbol: "AAA", universeSource: "CORE" },
      { symbolId: "s9", symbol: "GEX", universeSource: "TACTICAL" },
    ]);
    expect(r.includedTacticalIds).toEqual(["t1"]);
  });

  it("marks overlap as BOTH and evaluates once", () => {
    const r = computeEffectiveScanUniverse({
      coreRows: [{ id: "s1", symbol: "AAA" }],
      tacticalRows: [
        {
          tacticalId: "t1",
          tacticalSymbol: "aaa",
          stockSymbolId: "s1",
        },
      ],
    });
    expect(r.symbols).toEqual([
      { symbolId: "s1", symbol: "AAA", universeSource: "BOTH" },
    ]);
    expect(r.stats.overlapCount).toBe(1);
    expect(r.stats.effectiveCount).toBe(1);
  });

  it("excludes tactical rows missing stock symbol mapping", () => {
    const r = computeEffectiveScanUniverse({
      coreRows: [{ id: "s1", symbol: "AAA" }],
      tacticalRows: [
        {
          tacticalId: "t1",
          tacticalSymbol: "GEX",
          stockSymbolId: null,
        },
      ],
    });
    expect(r.symbols).toEqual([
      { symbolId: "s1", symbol: "AAA", universeSource: "CORE" },
    ]);
    expect(r.stats.tacticalMissingStockSymbolCount).toBe(1);
    expect(r.includedTacticalIds).toEqual([]);
  });
});
