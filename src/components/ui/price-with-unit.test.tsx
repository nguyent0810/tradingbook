import { describe, expect, it } from "vitest";
import { formatEquityThousandVndPerShare } from "@/lib/formatters";
import { splitThousandVndFormatted } from "./price-with-unit";

describe("PriceWithUnit / formatEquityThousandVndPerShare parity", () => {
  it("formats 42.5 as 42.5k ₫", () => {
    expect(formatEquityThousandVndPerShare(42.5)).toBe("42.5k ₫");
  });

  it("splits formatted thousand-VND string", () => {
    expect(splitThousandVndFormatted("42.5k ₫")).toEqual({
      numeric: "42.5",
      unit: "k ₫",
    });
  });

  it("returns null split for em dash", () => {
    expect(splitThousandVndFormatted("—")).toBeNull();
  });
});
