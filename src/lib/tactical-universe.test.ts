import { describe, expect, it, vi } from "vitest";
import {
  buildActiveTacticalSymbolWhere,
  computeEffectiveScanUniverse,
  isTacticalSymbolActiveNow,
  loadEffectiveScanUniverse,
  normalizeTacticalSymbolInput,
  toEffectiveUniverseSymbols,
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

describe("toEffectiveUniverseSymbols", () => {
  it("maps CORE/TACTICAL/BOTH to lowercase source with tactical metadata", () => {
    const rows = toEffectiveUniverseSymbols({
      symbols: [
        { symbolId: "s1", symbol: "AAA", universeSource: "CORE" },
        { symbolId: "s2", symbol: "BBB", universeSource: "TACTICAL" },
        { symbolId: "s3", symbol: "CCC", universeSource: "BOTH" },
      ],
      tacticalRows: [
        {
          id: "t2",
          symbol: "BBB",
          expiresAt: new Date("2026-06-01T00:00:00.000Z"),
        },
        {
          id: "t3",
          symbol: "CCC",
          expiresAt: new Date("2026-06-02T00:00:00.000Z"),
        },
      ],
    });

    expect(rows).toEqual([
      {
        symbol: "AAA",
        source: "core",
        stockSymbolId: "s1",
        tacticalId: undefined,
        reason: null,
        expiresAt: null,
      },
      {
        symbol: "BBB",
        source: "tactical",
        stockSymbolId: "s2",
        tacticalId: "t2",
        reason: null,
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      {
        symbol: "CCC",
        source: "both",
        stockSymbolId: "s3",
        tacticalId: "t3",
        reason: null,
        expiresAt: new Date("2026-06-02T00:00:00.000Z"),
      },
    ]);
  });
});

describe("loadEffectiveScanUniverse", () => {
  it("loads merged core+tactical universe via shared helper contract", async () => {
    const stockFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "s1", symbol: "AAA" },
        { id: "s2", symbol: "BBB" },
      ])
      .mockResolvedValueOnce([
        { id: "s2", symbol: "BBB" },
        { id: "s3", symbol: "GEX" },
      ]);
    const tacticalFindMany = vi.fn().mockResolvedValue([
      {
        id: "t1",
        symbol: "GEX",
        source: "manual",
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
        status: "ACTIVE",
        activeForScanner: true,
      },
      {
        id: "t2",
        symbol: "BBB",
        source: "manual",
        expiresAt: new Date("2026-06-02T00:00:00.000Z"),
        status: "ACTIVE",
        activeForScanner: true,
      },
    ]);

    const prisma = {
      stockSymbol: { findMany: stockFindMany },
      tacticalSymbol: { findMany: tacticalFindMany },
    } as unknown as Parameters<typeof loadEffectiveScanUniverse>[0];

    const out = await loadEffectiveScanUniverse(
      prisma,
      new Date("2026-05-20T00:00:00.000Z")
    );

    expect(out.symbols).toEqual([
      { symbolId: "s1", symbol: "AAA", universeSource: "CORE" },
      { symbolId: "s2", symbol: "BBB", universeSource: "BOTH" },
      { symbolId: "s3", symbol: "GEX", universeSource: "TACTICAL" },
    ]);
    expect(out.stats).toMatchObject({
      coreCount: 2,
      tacticalCount: 2,
      overlapCount: 1,
      effectiveCount: 3,
    });
    expect(out.effectiveSymbols.map((s) => s.source)).toEqual([
      "core",
      "both",
      "tactical",
    ]);
  });
});
