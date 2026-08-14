/**
 * D3 — ranking. SHADOW ONLY.
 *
 * `rankScore` is the one part of V1 that already satisfies its contract: it
 * orders and gates nothing. M1 does not redesign it and does not touch a single
 * weight. This module only wraps it in a typed contract and, crucially, records
 * WHICH PRIMITIVE each term came from so the known fan-out is observable instead
 * of implicit.
 *
 * The duplicate-source check implements I9b. It reports rather than repairs —
 * silently collapsing two volume measurements into one field is exactly what §6
 * of the M1 brief forbids.
 */
import type { Gate2RankComponents } from "@/lib/scanner/gate2/rank-components";
import type { RankingInput, RankingOutput, RankTermSource } from "./contracts";

/** Builds the ranking contract from the existing, unmodified rank breakdown. */
export function toRankingInput(components: Gate2RankComponents): RankingInput {
  return {
    terms: [
      { name: "volumeTerm", value: components.volumeTerm, source: "volRatioMedian" },
      { name: "extensionTerm", value: components.extensionTerm, source: "extensionPct" },
      { name: "maDistanceTerm", value: components.maDistanceTerm, source: "maDistancePct" },
      { name: "depthPenalty", value: -components.depthPenalty, source: "depthFrac" },
    ],
  };
}

export function decideRanking(input: RankingInput): RankingOutput {
  const score = input.terms.reduce((a, t) => a + t.value, 0);

  const seen = new Map<RankTermSource, number>();
  for (const t of input.terms) seen.set(t.source, (seen.get(t.source) ?? 0) + 1);
  const duplicatedSources = [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s);

  return { score, terms: input.terms, duplicatedSources };
}
