import { describe, expect, it } from "vitest";
import {
  computeExpiry,
  normalizeUniqueSymbols,
  parseAddTacticalCliOptions,
  resolveExpiresDays,
} from "./tactical-universe-ops";

describe("normalizeUniqueSymbols", () => {
  it("normalizes trim+uppercase and dedupes preserving first order", () => {
    expect(normalizeUniqueSymbols([" gex ", "GEE", "gex", " gee "])).toEqual([
      "GEX",
      "GEE",
    ]);
  });
});

describe("resolveExpiresDays", () => {
  it("defaults to 14 when flag is missing", () => {
    expect(resolveExpiresDays(null)).toBe(14);
  });

  it("throws for out-of-range values", () => {
    expect(() => resolveExpiresDays("0")).toThrow();
    expect(() => resolveExpiresDays("366")).toThrow();
  });
});

describe("parseAddTacticalCliOptions", () => {
  it("parses source/expires/note/create-missing flags", () => {
    const opts = parseAddTacticalCliOptions([
      "--source=manual",
      "--expires-days=21",
      "--note=hot watch",
      "--create-missing",
    ]);
    expect(opts).toEqual({
      source: "manual",
      expiresDays: 21,
      note: "hot watch",
      createMissing: true,
    });
  });
});

describe("computeExpiry", () => {
  it("adds full day offset", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");
    const exp = computeExpiry(now, 14);
    expect(exp.toISOString()).toBe("2026-05-21T00:00:00.000Z");
  });
});
