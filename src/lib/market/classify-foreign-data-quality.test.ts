import { describe, expect, it } from "vitest";
import { classifyForeignDataQuality } from "@/lib/market/classify-foreign-data-quality";

describe("classifyForeignDataQuality", () => {
  it("returns OK for complete non-zero foreign row", () => {
    expect(
      classifyForeignDataQuality({
        buyVolume: 100,
        sellVolume: 50,
        netVolume: 50,
        buyValueVnd: 1_000_000,
        sellValueVnd: 400_000,
        netValueVnd: 600_000,
      })
    ).toBe("OK");
  });

  it("returns ALL_ZERO when all numerics are zero", () => {
    expect(
      classifyForeignDataQuality({
        buyVolume: 0,
        sellVolume: 0,
        netVolume: 0,
        buyValueVnd: 0,
        sellValueVnd: 0,
        netValueVnd: 0,
      })
    ).toBe("ALL_ZERO");
  });

  it("returns PARTIAL when fields are missing", () => {
    expect(
      classifyForeignDataQuality({
        buyVolume: 100,
        sellVolume: null,
        netVolume: null,
        buyValueVnd: null,
        sellValueVnd: null,
        netValueVnd: null,
      })
    ).toBe("PARTIAL");
  });
});
