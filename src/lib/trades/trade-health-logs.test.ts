import { describe, expect, it } from "vitest";
import { normalizeTradeHealthLevel } from "@/lib/trades/trade-health-logs";

describe("normalizeTradeHealthLevel", () => {
  it("accepts SetupHealthLevel values", () => {
    expect(normalizeTradeHealthLevel("HEALTHY")).toBe("HEALTHY");
    expect(normalizeTradeHealthLevel("AT_RISK")).toBe("AT_RISK");
  });

  it("returns null for unknown or empty values", () => {
    expect(normalizeTradeHealthLevel("bogus")).toBeNull();
    expect(normalizeTradeHealthLevel(null)).toBeNull();
    expect(normalizeTradeHealthLevel("")).toBeNull();
  });
});
