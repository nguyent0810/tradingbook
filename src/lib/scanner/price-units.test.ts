import { describe, expect, it } from "vitest";
import { equityPriceToVnd, tradedValueVnd } from "./price-units";

describe("price-units (VCI thousand-VND quotes)", () => {
  it("equityPriceToVnd multiplies by 1000", () => {
    expect(equityPriceToVnd(74.7)).toBe(74_700);
    expect(equityPriceToVnd(4.5)).toBe(4500);
  });

  it("tradedValueVnd uses close×1000×volume", () => {
    expect(tradedValueVnd(55, 250_000)).toBe(55 * 1000 * 250_000);
    expect(tradedValueVnd(74.7, 100_000)).toBe(74.7 * 1000 * 100_000);
  });
});
