import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveReviewPeriod } from "@/lib/paper-lab/dna/allocation-review-job";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe("resolveReviewPeriod — prior completed period (never the current/new period)", () => {
  it("monthly: a July invocation reviews June, regardless of the day", () => {
    for (const now of [d(2026, 7, 1), d(2026, 7, 2), d(2026, 7, 15), d(2026, 7, 31)]) {
      const p = resolveReviewPeriod(now, "monthly");
      expect(p.start).toEqual(d(2026, 6, 1));
      expect(p.end).toEqual(d(2026, 6, 30));
    }
  });
  it("monthly: independent of whether the first session of the new month completed", () => {
    // July 1 before vs after any July session — period selection depends on the
    // calendar month of `now`, not on latest-session, so both resolve to June.
    expect(resolveReviewPeriod(d(2026, 7, 1), "monthly")).toEqual(resolveReviewPeriod(d(2026, 7, 15), "monthly"));
  });
  it("monthly: January invocation reviews the prior December (year wrap)", () => {
    const p = resolveReviewPeriod(d(2026, 1, 5), "monthly");
    expect(p.start).toEqual(d(2025, 12, 1));
    expect(p.end).toEqual(d(2025, 12, 31));
  });
  it("monthly: March invocation reviews February (non-leap end)", () => {
    expect(resolveReviewPeriod(d(2026, 3, 1), "monthly").end).toEqual(d(2026, 2, 28));
  });
  it("quarterly: a Q3 invocation reviews Q2, regardless of completed Q3 sessions", () => {
    for (const now of [d(2026, 7, 1), d(2026, 8, 15), d(2026, 9, 30)]) {
      const p = resolveReviewPeriod(now, "quarterly");
      expect(p.start).toEqual(d(2026, 4, 1)); // Q2 start
      expect(p.end).toEqual(d(2026, 6, 30)); // Q2 end
    }
  });
  it("quarterly: a Q1 invocation reviews the prior Q4 (year wrap)", () => {
    const p = resolveReviewPeriod(d(2026, 2, 10), "quarterly");
    expect(p.start).toEqual(d(2025, 10, 1));
    expect(p.end).toEqual(d(2025, 12, 31));
  });
  it("period end is strictly before the current period (reviewDate can never be future)", () => {
    const now = d(2026, 7, 1);
    expect(resolveReviewPeriod(now, "monthly").end.getTime()).toBeLessThan(d(2026, 7, 1).getTime());
    expect(resolveReviewPeriod(now, "quarterly").end.getTime()).toBeLessThan(d(2026, 7, 1).getTime());
  });
});

describe("no-LLM guarantee", () => {
  it("the scheduled review job and store import no LLM client", () => {
    for (const f of ["allocation-review-job.ts", "allocation-store.ts"]) {
      const src = readFileSync(join(process.cwd(), "src", "lib", "paper-lab", "dna", f), "utf8");
      const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const s of imports) expect(/openai|anthropic|llm/i.test(s), `${f} imports ${s}`).toBe(false);
    }
  });
});
