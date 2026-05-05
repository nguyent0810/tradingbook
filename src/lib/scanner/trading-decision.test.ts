import { describe, expect, it } from "vitest";
import {
  computeDailyTradingDecision,
  parsePersistedDailyDecision,
  toPersistedDailyDecision,
} from "./trading-decision";

describe("computeDailyTradingDecision", () => {
  it("FAIL → NO_TRADE 0%", () => {
    expect(
      computeDailyTradingDecision({
        gate1Level: "FAIL",
        candidateCountA: 2,
        candidateCountB: 3,
      })
    ).toEqual({
      level: "NO_TRADE",
      allocation: "0%",
      explanation: "Market conditions are unfavorable.",
    });
  });

  it("PASS + any A/B → NORMAL 50-70%", () => {
    expect(
      computeDailyTradingDecision({
        gate1Level: "PASS",
        candidateCountA: 1,
        candidateCountB: 0,
      })
    ).toEqual({
      level: "NORMAL",
      allocation: "50-70%",
      explanation: "Market is supportive and valid setups are available.",
    });
    expect(
      computeDailyTradingDecision({
        gate1Level: "PASS",
        candidateCountA: 0,
        candidateCountB: 2,
      })
    ).toMatchObject({ level: "NORMAL", allocation: "50-70%" });
  });

  it("PASS + zero setups → NO_TRADE 0%", () => {
    expect(
      computeDailyTradingDecision({
        gate1Level: "PASS",
        candidateCountA: 0,
        candidateCountB: 0,
      })
    ).toEqual({
      level: "NO_TRADE",
      allocation: "0%",
      explanation: "Market is supportive, but no valid setup is available.",
    });
  });

  it("WARNING + A>0 → PROBE 20-40%", () => {
    expect(
      computeDailyTradingDecision({
        gate1Level: "WARNING",
        candidateCountA: 1,
        candidateCountB: 0,
      })
    ).toEqual({
      level: "PROBE",
      allocation: "20-40%",
      explanation: "Only small exposure is allowed because market conditions are mixed.",
    });
  });

  it("WARNING + no A → NO_TRADE 0%", () => {
    expect(
      computeDailyTradingDecision({
        gate1Level: "WARNING",
        candidateCountA: 0,
        candidateCountB: 5,
      })
    ).toEqual({
      level: "NO_TRADE",
      allocation: "0%",
      explanation: "Market is mixed and no Tier A setup is available.",
    });
  });
});

describe("parsePersistedDailyDecision", () => {
  it("accepts valid persisted shape", () => {
    const d = { level: "PROBE" as const, allocation: "20-40%", explanation: "test" };
    expect(parsePersistedDailyDecision(d)).toEqual(d);
    expect(toPersistedDailyDecision(d)).toEqual(d);
  });

  it("rejects invalid level", () => {
    expect(parsePersistedDailyDecision({ level: "HOLD", allocation: "0%", explanation: "x" })).toBeNull();
  });

  it("maps legacy AGGRESSIVE to NORMAL guidance", () => {
    expect(
      parsePersistedDailyDecision({
        level: "AGGRESSIVE",
        allocation: "70-100%",
        explanation: "old copy",
      })
    ).toEqual({
      level: "NORMAL",
      allocation: "50-70%",
      explanation: "Market is supportive and valid setups are available.",
    });
  });
});
