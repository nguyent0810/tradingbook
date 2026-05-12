import { describe, expect, it } from "vitest";
import { detectTradePriceUnitMismatch } from "./price-unit-guard";

describe("detectTradePriceUnitMismatch", () => {
  it("flags 8800 vs 9 (likely nominal vs thousand-VND bar)", () => {
    expect(detectTradePriceUnitMismatch(8800, 9)).toBe(true);
  });

  it("does not flag 8.8 vs 9", () => {
    expect(detectTradePriceUnitMismatch(8.8, 9)).toBe(false);
  });

  it("does not flag 8800 vs 9000", () => {
    expect(detectTradePriceUnitMismatch(8800, 9000)).toBe(false);
  });

  it("does not flag when latest close is missing", () => {
    expect(detectTradePriceUnitMismatch(8800, null)).toBe(false);
  });
});
