import type { PrismaClient } from "@/generated/prisma/client";
import {
  categorizeTerminalReason,
  terminalGate2Reason,
  type TerminalCategory,
} from "./gate2-scan-diagnostics";
import { evaluateBreakoutPullbackCandidate } from "./gate2/breakout-pullback";
import { evaluateTradabilityForSymbolIdsBatched } from "./tradability";
import { rejectionBucketLabel } from "./setups-trader-copy";

export type Gate2CategoryBreakdownRow = {
  categoryKey: TerminalCategory | string;
  label: string;
  count: number;
  symbols: string[];
};

/**
 * Groups INVALID Gate 2 evaluations by terminal category for UI only.
 * Uses the same evaluator as the scanner; does not change thresholds.
 */
export async function fetchGate2InvalidBreakdown(
  prisma: PrismaClient,
  expectedLatestSession: Date
): Promise<Gate2CategoryBreakdownRow[]> {
  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
  });

  // One batched, bounded-lookback query for all active symbols' bars, evaluated
  // in-memory — replaces a tradability pass followed by a full-history findMany
  // per tradable symbol (the same fix already applied in rs-near-miss-watchlist).
  const evaluated = await evaluateTradabilityForSymbolIdsBatched(
    prisma,
    symbols,
    expectedLatestSession
  );

  // A chunk whose query failed contributes no entries. Silently omitting those symbols
  // would render a plausible-looking but incomplete rejection breakdown, so fail loudly
  // instead — the caller already turns this into a "database unavailable" state.
  const missingCount = symbols.reduce(
    (n, s) => (evaluated.has(s.id) ? n : n + 1),
    0
  );
  if (missingCount > 0) {
    throw new Error(
      `Bar fetch failed for ${missingCount}/${symbols.length} symbols — refusing to render a partial Gate 2 breakdown.`
    );
  }

  const symbolKeyById = new Map(symbols.map((s) => [s.id, s.symbol] as const));

  const bucket = new Map<string, string[]>();

  for (const s of symbols) {
    const entry = evaluated.get(s.id);
    if (!entry?.result.passed) continue;

    const ev = evaluateBreakoutPullbackCandidate(entry.bars, expectedLatestSession);
    if (ev.quality !== "INVALID") continue;

    const cat = categorizeTerminalReason(terminalGate2Reason(ev)).category;
    const key = cat as string;
    const sym = symbolKeyById.get(s.id) ?? s.id;
    const list = bucket.get(key) ?? [];
    list.push(sym);
    bucket.set(key, list);
  }

  const out: Gate2CategoryBreakdownRow[] = [];
  for (const [categoryKey, bucketSymbols] of bucket.entries()) {
    const sortedSymbols = [...bucketSymbols].sort((a, b) => a.localeCompare(b));
    out.push({
      categoryKey,
      label: rejectionBucketLabel(categoryKey),
      count: sortedSymbols.length,
      symbols: sortedSymbols,
    });
  }

  out.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return out;
}
