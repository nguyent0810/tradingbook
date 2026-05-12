import { describe, expect, it } from "vitest";
import {
  formatBarDataDateUtcLong,
  formatEquityThousandVndPerShare,
} from "@/lib/formatters";

describe("formatEquityThousandVndPerShare", () => {
  it("appends k ₫ for finite numbers", () => {
    expect(formatEquityThousandVndPerShare(9)).toBe("9k ₫");
    expect(formatEquityThousandVndPerShare(12.5)).toBe("12.5k ₫");
  });

  it("returns em dash for nullish or non-finite", () => {
    expect(formatEquityThousandVndPerShare(null)).toBe("—");
    expect(formatEquityThousandVndPerShare(undefined)).toBe("—");
    expect(formatEquityThousandVndPerShare(Number.NaN)).toBe("—");
  });
});

describe("formatBarDataDateUtcLong", () => {
  it("formats UTC calendar day in long English style", () => {
    const d = new Date(Date.UTC(2026, 4, 7));
    expect(formatBarDataDateUtcLong(d)).toMatch(/May 7, 2026/);
  });
});
