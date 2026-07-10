/**
 * Shadow Capital Allocation — review COMPUTATION (strictly read-only).
 *
 * `buildAllocationReview` gathers manager NAV series + monthly attribution and
 * computes scorecards, a proposal, and a deterministic input hash. It performs
 * NO writes — persistence (create-if-absent / reuse / conflict) is owned by the
 * scheduled job so an existing review is never overwritten. Never mutates
 * portfolio cash, NAV history, or starting capital; never writes a CapitalFlow.
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { MANAGER_SLUGS } from "@/lib/paper-lab/dna/manager-configs";
import {
  ALLOCATION_SCORING_VERSION,
  computeAllocationProposal,
  computeManagerScorecard,
  DEFAULT_TRAILING_WINDOW,
  type AttributionSummary,
  type Scorecard,
} from "@/lib/paper-lab/dna/allocation";

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}
function priorMonths(reviewDate: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(monthKey(new Date(Date.UTC(reviewDate.getUTCFullYear(), reviewDate.getUTCMonth() - i, 1))));
  return out;
}

export interface AllocationReviewComputation {
  reviewDate: string;
  cadence: string;
  scoringVersion: string;
  trailingWindowSessions: number;
  totalPoolVnd: number;
  scorecards: Scorecard[];
  proposals: ReturnType<typeof computeAllocationProposal>;
  currentAllocation: Record<string, number>;
  proposedAllocation: Record<string, number>;
  reasonCodes: Record<string, string[]>;
  /** Number of managers that had monthly attribution data (0 → all neutral). */
  attributionCoverage: number;
  inputHash: string;
}

/** Read-only: computes the review in memory. Does NOT persist anything. */
export async function buildAllocationReview(
  prisma: PrismaClient,
  reviewDate: Date,
  cadence: "monthly" | "quarterly" = "monthly",
  options?: { trailingWindowSessions?: number }
): Promise<AllocationReviewComputation> {
  const window = options?.trailingWindowSessions ?? DEFAULT_TRAILING_WINDOW;
  const months = priorMonths(reviewDate, 3);

  const managers = await prisma.paperAgent.findMany({ where: { slug: { in: [...MANAGER_SLUGS] } }, include: { portfolio: true } });
  const totalPool = managers.reduce((s, m) => s + Number(m.portfolio?.initialCapitalVnd ?? 0), 0);
  const currentAllocation: Record<string, number> = {};
  for (const m of managers) currentAllocation[m.slug] = totalPool > 0 ? Number(m.portfolio?.initialCapitalVnd ?? 0) / totalPool : 0;

  const scorecards: Scorecard[] = [];
  let attributionCoverage = 0;
  for (const m of managers) {
    if (!m.portfolio) continue;
    const snapsDesc = await prisma.portfolioSnapshot.findMany({ where: { portfolioId: m.portfolio.id, sessionDate: { lte: reviewDate } }, orderBy: { sessionDate: "desc" }, take: window });
    const navSeries = snapsDesc.map((s) => Number(s.navVnd)).reverse();

    const monthly = await prisma.managerAttributionMonthly.findMany({ where: { agentId: m.id, month: { in: months } } });
    let attribution: AttributionSummary | null = null;
    if (monthly.length > 0) {
      attributionCoverage += 1;
      const avg = (f: (r: (typeof monthly)[number]) => number) => monthly.reduce((s, r) => s + f(r), 0) / monthly.length;
      attribution = {
        avgEntryQuality: avg((r) => r.avgEntryQuality),
        avgHoldingQuality: avg((r) => r.avgHoldingQuality),
        avgExitQuality: avg((r) => r.avgExitQuality),
        avgSizingQuality: avg((r) => r.avgSizingQuality),
        avgRegimeFit: avg((r) => r.avgRegimeFit),
        avgRiskControl: avg((r) => r.avgRiskControl),
        cashDragVnd: monthly.reduce((s, r) => s + Number(r.cashDragVnd), 0),
        navVnd: navSeries[navSeries.length - 1] ?? Number(m.portfolio.initialCapitalVnd),
      };
    }
    scorecards.push(computeManagerScorecard({ slug: m.slug, navSeries, attribution, windowSessions: window }));
  }

  const proposals = computeAllocationProposal(scorecards, { currentAllocation: new Map(Object.entries(currentAllocation)) });

  // Hash reflects the accepted normalized inputs (deterministic, order-independent).
  const inputHash = createHash("sha256")
    .update(JSON.stringify({
      reviewDate: reviewDate.toISOString().slice(0, 10),
      cadence,
      scoringVersion: ALLOCATION_SCORING_VERSION,
      window,
      scorecards: [...scorecards].sort((a, b) => a.slug.localeCompare(b.slug)),
      currentAllocation,
    }))
    .digest("hex")
    .slice(0, 32);

  const reasonCodes: Record<string, string[]> = {};
  const proposedAllocation: Record<string, number> = {};
  for (const p of proposals) { reasonCodes[p.slug] = p.reasonCodes; proposedAllocation[p.slug] = p.proposedPct; }

  return {
    reviewDate: reviewDate.toISOString().slice(0, 10),
    cadence,
    scoringVersion: ALLOCATION_SCORING_VERSION,
    trailingWindowSessions: window,
    totalPoolVnd: totalPool,
    scorecards,
    proposals,
    currentAllocation,
    proposedAllocation,
    reasonCodes,
    attributionCoverage,
    inputHash,
  };
}
