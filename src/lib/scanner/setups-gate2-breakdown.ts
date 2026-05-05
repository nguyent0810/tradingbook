import type { PrismaClient } from "@/generated/prisma/client";
import {
  categorizeTerminalReason,
  terminalGate2Reason,
  type TerminalCategory,
} from "./gate2-scan-diagnostics";
import { evaluateBreakoutPullbackCandidate } from "./gate2/breakout-pullback";
import { evaluateTradabilityForAllActiveSymbols } from "./tradability";
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
  const { tradableSymbolIds, items } =
    await evaluateTradabilityForAllActiveSymbols(prisma, expectedLatestSession);

  const symbolKeyById = new Map(items.map((t) => [t.symbolId, t.symbolKey] as const));

  const bucket = new Map<string, string[]>();

  for (const symbolId of tradableSymbolIds) {
    const rows = await prisma.stockDailyBar.findMany({
      where: { symbolId },
      orderBy: { date: "asc" },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });

    const bars = rows.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    const ev = evaluateBreakoutPullbackCandidate(bars, expectedLatestSession);
    if (ev.quality !== "INVALID") continue;

    const cat = categorizeTerminalReason(terminalGate2Reason(ev)).category;
    const key = cat as string;
    const sym = symbolKeyById.get(symbolId) ?? symbolId;
    const list = bucket.get(key) ?? [];
    list.push(sym);
    bucket.set(key, list);
  }

  const out: Gate2CategoryBreakdownRow[] = [];
  for (const [categoryKey, symbols] of bucket.entries()) {
    const sortedSymbols = [...symbols].sort((a, b) => a.localeCompare(b));
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
