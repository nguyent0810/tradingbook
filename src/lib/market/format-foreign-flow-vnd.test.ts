import { describe, expect, it } from "vitest";
import {
  formatForeignFlowNetLabel,
  formatForeignFlowVnd,
} from "@/lib/market/format-foreign-flow-vnd";

describe("formatForeignFlowVnd", () => {
  it("formats negative production-scale net with compact B suffix", () => {
    expect(formatForeignFlowVnd(-458_371_893_440)).toBe("−458.37B ₫");
  });

  it("formats positive net with explicit plus sign", () => {
    expect(formatForeignFlowVnd(63_036_648_000)).toBe("+63.04B ₫");
  });

  it("returns null for null/undefined", () => {
    expect(formatForeignFlowVnd(null)).toBeNull();
    expect(formatForeignFlowVnd(undefined)).toBeNull();
  });

  it("formats zero without sign prefix", () => {
    expect(formatForeignFlowVnd(0)).toBe("0 ₫");
  });
});

describe("formatForeignFlowNetLabel", () => {
  it("appends net suffix for chip display", () => {
    expect(formatForeignFlowNetLabel(-458_371_893_440)).toBe("−458.37B ₫ net");
  });

  it("returns null when value is missing", () => {
    expect(formatForeignFlowNetLabel(null)).toBeNull();
  });
});
