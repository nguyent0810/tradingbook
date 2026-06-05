import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  type TierAActivationFile,
  validateTierAActivation,
} from "./tier-a-additive-activation";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("../../src/lib/scanner/expected-session", () => ({
  getExpectedLatestSessionFromIndexBars: vi.fn(),
}));

vi.mock("../../src/lib/tactical-universe", () => ({
  loadEffectiveScanUniverse: vi.fn(),
}));

import { getExpectedLatestSessionFromIndexBars } from "../../src/lib/scanner/expected-session";
import { loadEffectiveScanUniverse } from "../../src/lib/tactical-universe";

const EXPECTED_SESSION = new Date(Date.UTC(2026, 5, 5));
const COHORT_PATH = "data/expansion-300-cohort.json";

const TIER_A = [
  "HDB",
  "GEX",
  "VCG",
  "VNM",
  "VJC",
  "PLX",
  "POW",
  "GMD",
  "TPB",
  "GAS",
  "VIB",
  "GEE",
  "PNJ",
  "REE",
  "VGC",
  "SAB",
  "VTP",
  "SSB",
  "ACV",
  "ABB",
  "AAS",
  "BCR",
  "BGE",
] as const;

const BASELINE = Array.from({ length: 206 }, (_, i) => `BA${String(i).padStart(3, "0")}`);
const TIER_B = ["APS", "DDG", "ATG", "DFF", "AMS"];

function buildCohortDoc() {
  return {
    baselineActiveSymbols: BASELINE,
    additiveSymbols: [...TIER_A, ...TIER_B],
    additiveByTier: { tierA: [...TIER_A], tierB: TIER_B },
    symbolMetadata: Object.fromEntries(TIER_A.map((s) => [s, { tier: "A" }])),
  };
}

function baseActivation(overrides?: Partial<TierAActivationFile>): TierAActivationFile {
  return {
    version: 1,
    purpose: "tier_a_additive_only",
    sourceCohortFile: COHORT_PATH,
    baselineActiveCount: 206,
    expectedActiveCountAfter: 229,
    tierASymbols: [...TIER_A],
    ...overrides,
  };
}

type TierARow = {
  symbol: string;
  active: boolean;
  bars: Array<{ date: Date }>;
  _count: { bars: number };
};

function buildTierARows(
  overrides?: Partial<Record<string, Partial<TierARow>>>
): TierARow[] {
  return TIER_A.map((symbol) => ({
    symbol,
    active: false,
    bars: [{ date: EXPECTED_SESSION }],
    _count: { bars: 160 },
    ...overrides?.[symbol],
  }));
}

function mockPrisma(opts: {
  activeCount?: number;
  baselineActive?: boolean;
  baselineInactiveSymbols?: string[];
  tierARows?: TierARow[];
}): PrismaClient {
  const baselineRows = BASELINE.map((symbol) => ({
    symbol,
    active: opts.baselineInactiveSymbols?.includes(symbol)
      ? false
      : (opts.baselineActive ?? true),
  }));

  return {
    stockSymbol: {
      count: vi.fn().mockResolvedValue(opts.activeCount ?? 206),
      findMany: vi.fn().mockImplementation(({ where }: { where: { symbol: { in: string[] } } }) => {
        const symbols = where.symbol.in;
        if (symbols.length === BASELINE.length || symbols[0]?.startsWith("BA")) {
          return Promise.resolve(
            baselineRows.filter((r) => symbols.includes(r.symbol))
          );
        }
        const rows = opts.tierARows ?? buildTierARows();
        return Promise.resolve(rows.filter((r) => symbols.includes(r.symbol)));
      }),
    },
  } as unknown as PrismaClient;
}

function mockEffectiveUniverse(count = 206) {
  vi.mocked(loadEffectiveScanUniverse).mockResolvedValue({
    symbols: BASELINE.slice(0, count).map((symbol) => ({
      symbol,
      symbolId: symbol,
      universeSource: "CORE" as const,
    })),
    stats: {
      effectiveCount: count,
      tacticalCount: 0,
      tacticalMissingStockSymbolCount: 0,
    },
  });
}

beforeEach(() => {
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify(buildCohortDoc()));
  vi.mocked(getExpectedLatestSessionFromIndexBars).mockResolvedValue(EXPECTED_SESSION);
  mockEffectiveUniverse(206);
});

describe("validateTierAActivation", () => {
  it("passes happy path and projects active count 229", async () => {
    const result = await validateTierAActivation(
      mockPrisma({}),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(true);
    expect(result.tierAAllInactive).toBe(true);
    expect(result.tierAAllSessionAligned).toBe(true);
    expect(result.baselineAllStillActive).toBe(true);
    expect(result.noDuplicates).toBe(true);
    expect(result.noBaselineOverlap).toBe(true);
    expect(result.noTierBIncluded).toBe(true);
    expect(result.beforeActiveCount).toBe(206);
    expect(result.afterActiveCountIfApplied).toBe(229);
    expect(result.impact.afterProposedActivation.activeCoreCount).toBe(229);
    expect(result.impact.afterProposedActivation.newlyActivatedSymbols).toBe(23);
  });

  it("rejects duplicate Tier A symbols", async () => {
    const dup = baseActivation({
      tierASymbols: [...TIER_A.slice(0, 22), TIER_A[0]!, TIER_A[0]!],
    });
    const result = await validateTierAActivation(mockPrisma({}), dup, COHORT_PATH);

    expect(result.ok).toBe(false);
    expect(result.noDuplicates).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate symbols"))).toBe(true);
  });

  it("rejects baseline overlap", async () => {
    const overlap = baseActivation({
      tierASymbols: [...TIER_A.slice(1), BASELINE[0]!],
    });
    const result = await validateTierAActivation(mockPrisma({}), overlap, COHORT_PATH);

    expect(result.ok).toBe(false);
    expect(result.noBaselineOverlap).toBe(false);
    expect(result.errors.some((e) => e.includes("overlaps baseline actives"))).toBe(true);
  });

  it("rejects Tier B leakage", async () => {
    const leaked = baseActivation({
      tierASymbols: [...TIER_A.slice(1), TIER_B[0]!],
    });
    const result = await validateTierAActivation(mockPrisma({}), leaked, COHORT_PATH);

    expect(result.ok).toBe(false);
    expect(result.noTierBIncluded).toBe(false);
    expect(result.errors.some((e) => e.includes("Tier B symbols"))).toBe(true);
  });

  it("rejects non-inactive Tier A symbols", async () => {
    const rows = buildTierARows({ HDB: { symbol: "HDB", active: true, bars: [{ date: EXPECTED_SESSION }], _count: { bars: 160 } } });
    const result = await validateTierAActivation(
      mockPrisma({ tierARows: rows }),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(false);
    expect(result.tierAAllInactive).toBe(false);
    expect(result.errors.some((e) => e.includes("HDB: already active"))).toBe(true);
  });

  it("rejects non-session-aligned Tier A symbols", async () => {
    const stale = new Date(Date.UTC(2026, 5, 4));
    const rows = buildTierARows({
      VNM: { symbol: "VNM", active: false, bars: [{ date: stale }], _count: { bars: 160 } },
    });
    const result = await validateTierAActivation(
      mockPrisma({ tierARows: rows }),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(false);
    expect(result.tierAAllSessionAligned).toBe(false);
    expect(result.errors.some((e) => e.includes("VNM: latest") && e.includes("2026-06-05"))).toBe(
      true
    );
  });

  it("rejects when baseline symbols are not all active", async () => {
    const result = await validateTierAActivation(
      mockPrisma({ baselineInactiveSymbols: [BASELINE[0]!] }),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(false);
    expect(result.baselineAllStillActive).toBe(false);
    expect(result.errors.some((e) => e.includes("Baseline symbols not active"))).toBe(true);
  });
});
