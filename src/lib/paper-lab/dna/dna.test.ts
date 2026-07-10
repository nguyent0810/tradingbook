import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAPER_AGENT_SEEDS } from "@/lib/paper-lab/constants";
import { isKnownReasonCode } from "@/lib/paper-lab/contracts/reason-codes";
import {
  AGENT_DNA,
  MANAGER_SLUGS,
  getManagerDna,
  hasManagerDna,
} from "@/lib/paper-lab/dna/manager-configs";
import { DNA_VERSION, type FundManagerDna } from "@/lib/paper-lab/dna/fund-manager-dna";
import { validateAllDna, findDnaViolations } from "@/lib/paper-lab/dna/dna-validation";

const EXPECTED_NAMES: Record<string, string> = {
  aggressive_investor: "Breakout Hunter",
  value_investor: "Pullback Operator",
  momentum_investor: "RS Rotator",
  trend_follower: "Trend Rider",
  swing_trader: "Swing Tactician",
  mean_reversion_trader: "Mean-Reversion Dip",
  devils_advocate: "Early Bird",
  safe_investor: "All-Weather Allocator",
  risk_manager: "Risk Warden",
};

describe("Fund Manager DNA coverage", () => {
  it("provides a config for every existing non-cio agent slug", () => {
    const slugs = PAPER_AGENT_SEEDS.map((s) => s.slug).filter((s) => s !== "cio");
    expect(slugs.length).toBe(9);
    for (const slug of slugs) {
      expect(hasManagerDna(slug)).toBe(true);
      expect(getManagerDna(slug)).toBeDefined();
    }
  });

  it("maps each slug to the correct manager identity", () => {
    for (const [slug, name] of Object.entries(EXPECTED_NAMES)) {
      expect(getManagerDna(slug)?.identity.name).toBe(name);
    }
  });

  it("returns undefined for non-manager slugs (e.g. cio)", () => {
    expect(getManagerDna("cio")).toBeUndefined();
    expect(getManagerDna("nope")).toBeUndefined();
  });

  it("stamps every config with the composite DNA_VERSION", () => {
    for (const slug of MANAGER_SLUGS) {
      expect(AGENT_DNA[slug].versioning.dnaVersion).toBe(DNA_VERSION);
      expect(AGENT_DNA[slug].versioning.strategyVersion).toBeTruthy();
    }
  });
});

describe("Fund Manager DNA is deterministic / frozen", () => {
  it("deep-freezes the registry and configs", () => {
    expect(Object.isFrozen(AGENT_DNA)).toBe(true);
    expect(Object.isFrozen(AGENT_DNA.aggressive_investor)).toBe(true);
    expect(Object.isFrozen(AGENT_DNA.aggressive_investor.portfolio)).toBe(true);
    expect(Object.isFrozen(AGENT_DNA.aggressive_investor.confidence.weights)).toBe(true);
  });

  it("rejects mutation at runtime", () => {
    expect(() => {
      (AGENT_DNA.aggressive_investor as unknown as { slug: string }).slug = "hacked";
    }).toThrow();
  });
});

describe("Fund Manager DNA respects platform caps and consistency", () => {
  it("has no cap/consistency violations across all 9 managers", () => {
    expect(validateAllDna()).toEqual([]);
  });

  it("flags a deliberately invalid config (sanity check on the validator)", () => {
    const broken = {
      ...AGENT_DNA.risk_manager,
      portfolio: { ...AGENT_DNA.risk_manager.portfolio, maxPortfolioExposurePct: 0.95 },
      confidence: { ...AGENT_DNA.risk_manager.confidence, weights: { gate2: 0.5, rs: 0.5, volume: 0.5, regime: 0.5, dual: 0.5 } },
    } as FundManagerDna;
    const violations = findDnaViolations(broken);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe("Fund Manager DNA reason codes are known", () => {
  it("only uses codes from the canonical catalog", () => {
    for (const slug of MANAGER_SLUGS) {
      for (const code of AGENT_DNA[slug].strategy.reasonCodes) {
        expect(isKnownReasonCode(code)).toBe(true);
      }
    }
  });
});

describe("Fund Manager DNA profiles are distinct", () => {
  const sections = ["strategy", "portfolio", "position", "psychology", "marketMemory", "rotation"] as const;

  for (const section of sections) {
    it(`gives every manager a distinct ${section} profile`, () => {
      const seen = new Map<string, string>();
      for (const slug of MANAGER_SLUGS) {
        const key = JSON.stringify(AGENT_DNA[slug][section]);
        expect(seen.has(key), `${slug} duplicates ${seen.get(key)} on ${section}`).toBe(false);
        seen.set(key, slug);
      }
    });
  }

  it("gives every manager a distinct archetype and identity name", () => {
    expect(new Set(MANAGER_SLUGS.map((s) => AGENT_DNA[s].archetype)).size).toBe(9);
    expect(new Set(MANAGER_SLUGS.map((s) => AGENT_DNA[s].identity.name)).size).toBe(9);
  });
});

describe("Fund Manager DNA has no LLM dependency", () => {
  it("imports nothing LLM-related in any dna module", () => {
    const dir = join(process.cwd(), "src", "lib", "paper-lab", "dna");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(join(dir, file), "utf8");
      // Inspect import specifiers only (comments may legitimately mention "LLM").
      const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const spec of imports) {
        expect(/openai|anthropic|llm/i.test(spec), `${file} imports ${spec}`).toBe(false);
      }
      expect(/fetch\s*\(/.test(src), `${file} performs a network call`).toBe(false);
    }
  });
});
