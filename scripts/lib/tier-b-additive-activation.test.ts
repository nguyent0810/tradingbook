import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  type TierBActivationFile,
  validateTierBActivation,
} from "./tier-b-additive-activation";

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

const TIER_A = ["HDB", "GEX", "VCG", "VNM", "VJC"];
const TIER_B = [
  "APS",
  "DDG",
  "ATG",
  "DFF",
  "AMS",
  "BOT",
  "AVG",
  "AMV",
  "ACM",
  "DCS",
  "CVN",
  "CET",
  "BCA",
  "AGM",
  "CAR",
  "CNN",
  "CEN",
  "BXH",
  "BTW",
  "CLC",
  "CVT",
  "CDO",
  "CT3",
  "C21",
  "BVG",
  "BGW",
  "CBI",
  "DCT",
  "BTT",
  "CRV",
  "DC1",
  "BLF",
  "CKV",
  "ARM",
  "ASG",
  "BVN",
  "DAN",
  "CLW",
  "ALT",
  "DHN",
  "COM",
  "BCF",
  "BCP",
  "CHC",
  "BIO",
  "DDH",
  "BMG",
  "BRR",
  "CMF",
  "ATA",
  "CAN",
  "BMK",
  "CPI",
  "C22",
  "CX8",
  "CQT",
  "CAD",
  "AMC",
  "CCT",
  "BTV",
  "BBH",
  "DBM",
  "DDM",
  "BDW",
  "BSG",
  "CMI",
  "AIC",
  "C92",
  "BAX",
  "BQB",
  "AME",
] as const;

const BASELINE = Array.from({ length: 206 }, (_, i) => `BA${String(i).padStart(3, "0")}`);

function buildCohortDoc() {
  return {
    baselineActiveSymbols: BASELINE,
    additiveSymbols: [...TIER_A, ...TIER_B],
    additiveByTier: { tierA: [...TIER_A], tierB: [...TIER_B] },
    symbolMetadata: Object.fromEntries(TIER_B.map((s) => [s, { tier: "B" }])),
  };
}

function baseActivation(overrides?: Partial<TierBActivationFile>): TierBActivationFile {
  return {
    version: 1,
    purpose: "tier_b_additive_only",
    sourceCohortFile: COHORT_PATH,
    baselineActiveCount: 229,
    expectedActiveCountAfter: 300,
    tierBSymbols: [...TIER_B],
    ...overrides,
  };
}

type Row = {
  symbol: string;
  active: boolean;
  bars: Array<{ date: Date }>;
  _count: { bars: number };
};

function buildTierBRows(overrides?: Partial<Record<string, Partial<Row>>>): Row[] {
  return TIER_B.map((symbol) => ({
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
  tierAActive?: boolean;
  tierAInactiveSymbols?: string[];
  tierBRows?: Row[];
}): PrismaClient {
  const baselineRows = BASELINE.map((symbol) => ({
    symbol,
    active: opts.baselineInactiveSymbols?.includes(symbol)
      ? false
      : (opts.baselineActive ?? true),
  }));
  const tierARows = TIER_A.map((symbol) => ({
    symbol,
    active: opts.tierAInactiveSymbols?.includes(symbol) ? false : (opts.tierAActive ?? true),
  }));

  return {
    stockSymbol: {
      count: vi.fn().mockResolvedValue(opts.activeCount ?? 229),
      findMany: vi.fn().mockImplementation(({ where }: { where: { symbol: { in: string[] } } }) => {
        const symbols = where.symbol.in;
        if (symbols.length === BASELINE.length || symbols[0]?.startsWith("BA0")) {
          return Promise.resolve(baselineRows.filter((r) => symbols.includes(r.symbol)));
        }
        if (symbols.length === TIER_A.length && TIER_A.every((s) => symbols.includes(s))) {
          return Promise.resolve(tierARows.filter((r) => symbols.includes(r.symbol)));
        }
        const rows = opts.tierBRows ?? buildTierBRows();
        return Promise.resolve(rows.filter((r) => symbols.includes(r.symbol)));
      }),
    },
  } as unknown as PrismaClient;
}

function mockEffectiveUniverse(count = 229) {
  vi.mocked(loadEffectiveScanUniverse).mockResolvedValue({
    symbols: BASELINE.slice(0, Math.min(count, BASELINE.length)).map((symbol) => ({
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
  mockEffectiveUniverse(229);
});

describe("validateTierBActivation", () => {
  it("passes happy path and projects active count 300", async () => {
    const result = await validateTierBActivation(mockPrisma({}), baseActivation(), COHORT_PATH);

    expect(result.ok).toBe(true);
    expect(result.tierBAllInactive).toBe(true);
    expect(result.tierBAllSessionAligned).toBe(true);
    expect(result.baselineAllStillActive).toBe(true);
    expect(result.tierAAllStillActive).toBe(true);
    expect(result.noDuplicates).toBe(true);
    expect(result.noBaselineOverlap).toBe(true);
    expect(result.noTierAIncluded).toBe(true);
    expect(result.beforeActiveCount).toBe(229);
    expect(result.afterActiveCountIfApplied).toBe(300);
    expect(result.impact.afterProposedActivation.activeCoreCount).toBe(300);
    expect(result.impact.afterProposedActivation.newlyActivatedSymbols).toBe(71);
  });

  it("rejects duplicate Tier B symbols", async () => {
    const dup = baseActivation({
      tierBSymbols: [...TIER_B.slice(0, 70), TIER_B[0]!, TIER_B[0]!],
    });
    const result = await validateTierBActivation(mockPrisma({}), dup, COHORT_PATH);

    expect(result.ok).toBe(false);
    expect(result.noDuplicates).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate symbols"))).toBe(true);
  });

  it("rejects baseline overlap", async () => {
    const overlap = baseActivation({
      tierBSymbols: [...TIER_B.slice(1), BASELINE[0]!],
    });
    const result = await validateTierBActivation(mockPrisma({}), overlap, COHORT_PATH);

    expect(result.ok).toBe(false);
    expect(result.noBaselineOverlap).toBe(false);
    expect(result.errors.some((e) => e.includes("overlaps baseline actives"))).toBe(true);
  });

  it("rejects Tier A leakage", async () => {
    const leaked = baseActivation({
      tierBSymbols: [...TIER_B.slice(1), TIER_A[0]!],
    });
    const result = await validateTierBActivation(mockPrisma({}), leaked, COHORT_PATH);

    expect(result.ok).toBe(false);
    expect(result.noTierAIncluded).toBe(false);
    expect(result.errors.some((e) => e.includes("Tier A symbols"))).toBe(true);
  });

  it("rejects non-inactive Tier B symbols", async () => {
    const rows = buildTierBRows({
      APS: { symbol: "APS", active: true, bars: [{ date: EXPECTED_SESSION }], _count: { bars: 160 } },
    });
    const result = await validateTierBActivation(
      mockPrisma({ tierBRows: rows }),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(false);
    expect(result.tierBAllInactive).toBe(false);
    expect(result.errors.some((e) => e.includes("APS: already active"))).toBe(true);
  });

  it("flags non-session-aligned Tier B symbols as a warning, not a blocking error (partial-batch activation)", async () => {
    const stale = new Date(Date.UTC(2026, 5, 4));
    const rows = buildTierBRows({
      DDG: { symbol: "DDG", active: false, bars: [{ date: stale }], _count: { bars: 160 } },
    });
    const result = await validateTierBActivation(
      mockPrisma({ tierBRows: rows }),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(true);
    expect(result.tierBAllSessionAligned).toBe(false);
    const ddg = result.perSymbol.find((r) => r.symbol === "DDG");
    expect(ddg?.sessionAligned).toBe(false);
    expect(ddg?.weekdaySessionsStale).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("DDG: latest") && w.includes("2026-06-05"))).toBe(
      true
    );
  });

  it("treats a symbol within the weekday-stale tolerance as aligned", async () => {
    // EXPECTED_SESSION = 2026-06-05 (Fri); 2026-06-04 (Thu) is 1 weekday session stale.
    const oneWeekdayStale = new Date(Date.UTC(2026, 5, 4));
    const rows = buildTierBRows({
      DDG: { symbol: "DDG", active: false, bars: [{ date: oneWeekdayStale }], _count: { bars: 160 } },
    });
    const result = await validateTierBActivation(
      mockPrisma({ tierBRows: rows }),
      baseActivation(),
      COHORT_PATH,
      { maxWeekdaySessionsStale: 5 }
    );

    expect(result.ok).toBe(true);
    const ddg = result.perSymbol.find((r) => r.symbol === "DDG");
    expect(ddg?.sessionAligned).toBe(true);
    expect(ddg?.weekdaySessionsStale).toBe(1);
  });

  it("rejects when baseline symbols are not all active", async () => {
    const result = await validateTierBActivation(
      mockPrisma({ baselineInactiveSymbols: [BASELINE[0]!] }),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(false);
    expect(result.baselineAllStillActive).toBe(false);
    expect(result.errors.some((e) => e.includes("Baseline symbols not active"))).toBe(true);
  });

  it("rejects when Tier A symbols are not all active", async () => {
    const result = await validateTierBActivation(
      mockPrisma({ tierAInactiveSymbols: [TIER_A[0]!] }),
      baseActivation(),
      COHORT_PATH
    );

    expect(result.ok).toBe(false);
    expect(result.tierAAllStillActive).toBe(false);
    expect(result.errors.some((e) => e.includes("Tier A symbols not active"))).toBe(true);
  });
});
