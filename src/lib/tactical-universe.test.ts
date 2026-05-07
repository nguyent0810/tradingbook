import { describe, expect, it } from "vitest";
import {
  buildActiveTacticalSymbolWhere,
  isTacticalSymbolActiveNow,
  normalizeTacticalSymbolInput,
} from "./tactical-universe";

describe("normalizeTacticalSymbolInput", () => {
  it("trims and uppercases ticker text", () => {
    expect(normalizeTacticalSymbolInput("  gEx ")).toBe("GEX");
  });

  it("throws when symbol is empty after trim", () => {
    expect(() => normalizeTacticalSymbolInput("   ")).toThrow(
      "Tactical symbol is required."
    );
  });
});

describe("isTacticalSymbolActiveNow", () => {
  const now = new Date("2026-05-07T00:00:00.000Z");

  it("is active only when ACTIVE + scanner flag true + not expired", () => {
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "ACTIVE",
          activeForScanner: true,
          expiresAt: new Date("2026-05-08T00:00:00.000Z"),
        },
        now
      )
    ).toBe(true);
  });

  it("returns false for expired row", () => {
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "ACTIVE",
          activeForScanner: true,
          expiresAt: new Date("2026-05-06T23:59:59.999Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("returns false for EXPIRED/REMOVED regardless of expiration time", () => {
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "EXPIRED",
          activeForScanner: true,
          expiresAt: new Date("2026-05-09T00:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
    expect(
      isTacticalSymbolActiveNow(
        {
          status: "REMOVED",
          activeForScanner: true,
          expiresAt: new Date("2026-05-09T00:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
  });
});

describe("buildActiveTacticalSymbolWhere", () => {
  it("builds status+scanner+expiry filter", () => {
    const now = new Date("2026-05-07T00:00:00.000Z");
    expect(buildActiveTacticalSymbolWhere(now)).toEqual({
      status: "ACTIVE",
      activeForScanner: true,
      expiresAt: { gt: now },
    });
  });
});
