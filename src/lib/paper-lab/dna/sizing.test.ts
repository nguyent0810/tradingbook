import { describe, expect, it } from "vitest";
import { AGENT_DNA } from "@/lib/paper-lab/dna/manager-configs";
import { computeManagerPositionSize } from "@/lib/paper-lab/dna/sizing";

const dna = AGENT_DNA.aggressive_investor; // baseRisk 1%, maxPerSymbol 0.2

describe("computeManagerPositionSize", () => {
  it("rounds down to the board lot", () => {
    // perShareRisk 1.3 → risk-capped ~3846 shares → floors to 3800.
    const s = computeManagerPositionSize({ navVnd: 500_000_000, cashVnd: 500_000_000, entryKVnd: 20, stopKVnd: 18.7, dna, psychMod: 1 });
    expect(s).not.toBeNull();
    expect(s!.quantity).toBe(3800);
    expect(s!.quantity % 100).toBe(0);
  });

  it("is capped by available cash", () => {
    const s = computeManagerPositionSize({ navVnd: 500_000_000, cashVnd: 10_000_000, entryKVnd: 20, stopKVnd: 19, dna, psychMod: 1 });
    expect(s).not.toBeNull();
    expect(s!.cappedBy).toBe("cash");
    expect(s!.quantity).toBe(400);
  });

  it("is capped by per-symbol exposure", () => {
    // Tiny per-share risk lets risk-sizing run huge; exposure cap (nav*0.2) binds.
    const s = computeManagerPositionSize({ navVnd: 500_000_000, cashVnd: 500_000_000, entryKVnd: 20, stopKVnd: 19.9, dna, psychMod: 1 });
    expect(s).not.toBeNull();
    expect(s!.cappedBy).toBe("exposure");
    expect(s!.quantity).toBe(5000); // floor(500M*0.2 / 20k)
  });

  it("returns null for invalid risk geometry (stop >= entry)", () => {
    expect(computeManagerPositionSize({ navVnd: 500_000_000, cashVnd: 500_000_000, entryKVnd: 20, stopKVnd: 20, dna, psychMod: 1 })).toBeNull();
    expect(computeManagerPositionSize({ navVnd: 500_000_000, cashVnd: 500_000_000, entryKVnd: 20, stopKVnd: 21, dna, psychMod: 1 })).toBeNull();
  });

  it("returns null when size is below one board lot", () => {
    const s = computeManagerPositionSize({ navVnd: 100_000, cashVnd: 100_000, entryKVnd: 20, stopKVnd: 19, dna, psychMod: 1 });
    expect(s).toBeNull();
  });

  it("scales down with a psychology modulation < 1", () => {
    const full = computeManagerPositionSize({ navVnd: 500_000_000, cashVnd: 500_000_000, entryKVnd: 20, stopKVnd: 18.7, dna, psychMod: 1 });
    const cut = computeManagerPositionSize({ navVnd: 500_000_000, cashVnd: 500_000_000, entryKVnd: 20, stopKVnd: 18.7, dna, psychMod: 0.5 });
    expect(cut!.quantity).toBeLessThan(full!.quantity);
  });
});
