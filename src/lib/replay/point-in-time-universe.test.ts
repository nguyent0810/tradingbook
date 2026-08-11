import { describe, expect, it } from "vitest";
import {
  estimateSurvivorshipExposure,
  resolvePointInTimeUniverse,
  tacticalSymbolsAsOf,
  type SymbolActivityRow,
  type TacticalWindowRow,
} from "./point-in-time-universe";

function act(over: Partial<SymbolActivityRow> = {}): SymbolActivityRow {
  return {
    symbolId: "id-FPT",
    symbol: "FPT",
    barsInWindow: 200,
    lastBarDate: "2024-06-28",
    firstBarDateEver: "2018-01-02",
    ...over,
  };
}

function tac(over: Partial<TacticalWindowRow> = {}): TacticalWindowRow {
  return {
    symbol: "GEX",
    addedAt: "2024-01-15T00:00:00.000Z",
    expiresAt: "2024-12-31T00:00:00.000Z",
    status: "ACTIVE",
    activeForScanner: true,
    ...over,
  };
}

const SESSION = "2024-06-28";

describe("tacticalSymbolsAsOf", () => {
  it("includes a tactical symbol inside its window", () => {
    expect(tacticalSymbolsAsOf([tac()], SESSION)).toEqual(["GEX"]);
  });

  it("EXCLUDES one added after the session — the leak this replaces", () => {
    // The old predicate only checked expiresAt > now, so a symbol added in 2026
    // with a 2027 expiry passed a 2024 replay.
    expect(
      tacticalSymbolsAsOf([tac({ addedAt: "2026-07-01T00:00:00.000Z", expiresAt: "2027-01-01T00:00:00.000Z" })], SESSION)
    ).toEqual([]);
  });

  it("excludes one whose window already closed", () => {
    expect(tacticalSymbolsAsOf([tac({ expiresAt: "2024-03-01T00:00:00.000Z" })], SESSION)).toEqual([]);
  });

  it("excludes revoked or scanner-disabled rows", () => {
    expect(tacticalSymbolsAsOf([tac({ status: "REVOKED" })], SESSION)).toEqual([]);
    expect(tacticalSymbolsAsOf([tac({ activeForScanner: false })], SESSION)).toEqual([]);
  });

  it("treats the expiry bound as exclusive and the added bound as inclusive", () => {
    expect(tacticalSymbolsAsOf([tac({ expiresAt: `${SESSION}T00:00:00.000Z` })], SESSION)).toEqual([]);
    expect(tacticalSymbolsAsOf([tac({ addedAt: `${SESSION}T00:00:00.000Z` })], SESSION)).toEqual(["GEX"]);
  });

  it("de-duplicates repeated tickers", () => {
    expect(tacticalSymbolsAsOf([tac(), tac({ symbol: " gex " })], SESSION)).toEqual(["GEX"]);
  });
});

describe("resolvePointInTimeUniverse", () => {
  it("includes a symbol trading through the session", () => {
    const u = resolvePointInTimeUniverse({ sessionDate: SESSION, activity: [act()], tactical: [] });
    expect(u.members.map((m) => m.symbol)).toEqual(["FPT"]);
    expect(u.stats.included).toBe(1);
  });

  it("EXCLUDES a symbol that had not listed yet — the survivorship fix", () => {
    // Its first bar ever is after the replayed session, so on that date it did
    // not exist. `active = true` today says nothing about that.
    const u = resolvePointInTimeUniverse({
      sessionDate: SESSION,
      activity: [act({ firstBarDateEver: "2025-10-10", lastBarDate: "2026-08-10" })],
      tactical: [],
    });
    expect(u.members).toEqual([]);
    expect(u.stats.excludedNotListedYet).toBe(1);
    expect(u.excluded[0]).toMatchObject({ reason: "not_listed_yet" });
  });

  it("excludes a symbol whose newest bar is long stale — suspended or delisted by then", () => {
    const u = resolvePointInTimeUniverse({
      sessionDate: SESSION,
      activity: [act({ lastBarDate: "2024-01-10" })],
      tactical: [],
    });
    expect(u.members).toEqual([]);
    expect(u.stats.excludedStale).toBe(1);
  });

  it("excludes a symbol with too little trading inside the window", () => {
    const u = resolvePointInTimeUniverse({
      sessionDate: SESSION,
      activity: [act({ barsInWindow: 40 })],
      tactical: [],
    });
    expect(u.stats.excludedTooFewBars).toBe(1);
    expect(u.excluded[0]!.reason).toContain("40_bars_in_window");
  });

  it("marks a symbol that is both core and tactical", () => {
    const u = resolvePointInTimeUniverse({
      sessionDate: SESSION,
      activity: [act({ symbol: "GEX", symbolId: "id-GEX" })],
      tactical: [tac()],
    });
    expect(u.members[0]).toMatchObject({ symbol: "GEX", source: "BOTH" });
    expect(u.stats.tacticalIncluded).toBe(1);
  });

  it("does not let a tactical entry rescue a symbol that fails the activity test", () => {
    // Tactical membership is additive to the universe, not a bypass of listing.
    const u = resolvePointInTimeUniverse({
      sessionDate: SESSION,
      activity: [act({ symbol: "GEX", firstBarDateEver: "2025-01-02" })],
      tactical: [tac()],
    });
    expect(u.members).toEqual([]);
  });

  it("returns members sorted so a replay is deterministic", () => {
    const u = resolvePointInTimeUniverse({
      sessionDate: SESSION,
      activity: [act({ symbol: "VCB", symbolId: "b" }), act({ symbol: "ACB", symbolId: "a" })],
      tactical: [],
    });
    expect(u.members.map((m) => m.symbol)).toEqual(["ACB", "VCB"]);
  });

  it("honours overridden thresholds", () => {
    const u = resolvePointInTimeUniverse({
      sessionDate: SESSION,
      activity: [act({ barsInWindow: 40 })],
      tactical: [],
      options: { minBarsInWindow: 30 },
    });
    expect(u.stats.included).toBe(1);
  });
});

describe("estimateSurvivorshipExposure", () => {
  it("calls a large unreplayable share material and says results are survivor-conditional", () => {
    const e = estimateSurvivorshipExposure({
      totalSymbolsKnown: 1537,
      symbolsWithAnyBars: 281,
      replayedUniverseSize: 281,
    });
    expect(e.unreplayableSymbols).toBe(1256);
    expect(e.verdict).toBe("material");
    expect(e.note).toContain("survivor-conditional");
  });

  it("calls a small share minor but still non-zero", () => {
    const e = estimateSurvivorshipExposure({
      totalSymbolsKnown: 300,
      symbolsWithAnyBars: 295,
      replayedUniverseSize: 295,
    });
    expect(e.verdict).toBe("minor");
    expect(e.unreplayablePct).toBeCloseTo(1.7, 1);
  });

  it("never reports a negative hole", () => {
    const e = estimateSurvivorshipExposure({
      totalSymbolsKnown: 10,
      symbolsWithAnyBars: 12,
      replayedUniverseSize: 10,
    });
    expect(e.unreplayableSymbols).toBe(0);
  });
});
