/**
 * Tradability diagnostics: bar coverage, liquidity ranks, failure breakdown,
 * and scaled traded-value probes (to infer vnstock price units).
 *
 * Usage: npx tsx scripts/tradability-audit.ts
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { tradedValueVnd } from "../src/lib/scanner/price-units";
import {
  TRADABILITY_MIN_BARS,
  TRADABILITY_ROLLING_DAYS,
} from "../src/lib/scanner/tradability-constants";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

type Row = {
  symbolKey: string;
  symbolId: string;
  barCount: number;
  latestDate: Date | null;
  avgVol20: number | null;
  /** 20D mean traded value in VND (VCI: `tradedValueVnd` = close×1000×volume). */
  avgValue20Vnd: number | null;
  latestClose: number | null;
  result: Awaited<ReturnType<typeof evaluateTradabilityForSymbolId>>;
};

async function main(): Promise<void> {
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  const indexLatest = await prisma.indexDailyBar.findFirst({
    where: { symbol: "VNINDEX" },
    orderBy: { date: "desc" },
    select: { date: true, close: true },
  });

  const active = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  const rows: Row[] = [];

  for (const s of active) {
    const bars = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
      orderBy: { date: "asc" },
      select: { date: true, close: true, volume: true },
    });

    const barCount = bars.length;
    const latest = bars[bars.length - 1] ?? null;
    let avgVol20: number | null = null;
    let avgValue20Vnd: number | null = null;

    if (bars.length >= TRADABILITY_ROLLING_DAYS) {
      const last20 = bars.slice(-TRADABILITY_ROLLING_DAYS);
      avgVol20 = mean(last20.map((b) => b.volume));
      avgValue20Vnd = mean(
        last20.map((b) => tradedValueVnd(b.close, b.volume))
      );
    }

    const result = expected
      ? await evaluateTradabilityForSymbolId(prisma, s.id, expected)
      : { passed: false, reasons: ["No expected session from VNINDEX"] };

    rows.push({
      symbolKey: s.symbol,
      symbolId: s.id,
      barCount,
      latestDate: latest?.date ?? null,
      avgVol20,
      avgValue20Vnd,
      latestClose: latest?.close ?? null,
      result,
    });
  }

  const with120 = rows.filter((r) => r.barCount >= TRADABILITY_MIN_BARS);
  const latestByDay = new Map<string, number>();
  for (const r of rows) {
    if (!r.latestDate) continue;
    const k = r.latestDate.toISOString().slice(0, 10);
    latestByDay.set(k, (latestByDay.get(k) ?? 0) + 1);
  }
  const sortedDays = [...latestByDay.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  const pool20 = rows.filter((r) => r.avgVol20 !== null && r.avgValue20Vnd !== null);
  const byValue = [...pool20].sort(
    (a, b) => (b.avgValue20Vnd ?? 0) - (a.avgValue20Vnd ?? 0)
  );
  const byVol = [...pool20].sort((a, b) => (b.avgVol20 ?? 0) - (a.avgVol20 ?? 0));

  const byReason: Record<string, string[]> = {};
  for (const r of rows) {
    for (const reason of r.result.reasons) {
      if (!byReason[reason]) byReason[reason] = [];
      byReason[reason].push(r.symbolKey);
    }
  }

  const singleFailure = rows.filter(
    (r) => !r.result.passed && r.result.reasons.length === 1
  );
  const singleByReason: Record<string, string[]> = {};
  for (const r of singleFailure) {
    const only = r.result.reasons[0]!;
    if (!singleByReason[only]) singleByReason[only] = [];
    singleByReason[only].push(r.symbolKey);
  }

  const out = {
    expectedLatestSession: expected?.toISOString() ?? null,
    priceUnitNote:
      "Equity `StockDailyBar` from vnstock/VCI: OHLC in thousand VND; tradability uses `equityPriceToVnd` / `tradedValueVnd`. VNINDEX index bars are points, not share prices.",
    vnindexLatest: indexLatest
      ? {
          date: indexLatest.date.toISOString().slice(0, 10),
          close: indexLatest.close,
          note:
            "VNINDEX close is an index level (points), not a share price in VND; do not mix with stock TRADABILITY_MIN_CLOSE_VND.",
        }
      : null,
    activeStockSymbolCount: active.length,
    symbolsWithAtLeast120Bars: with120.length,
    latestBarDateDistribution: Object.fromEntries(sortedDays),
    top20By20dAvgTradedValueVnd: byValue.slice(0, 20).map((r) => ({
      symbol: r.symbolKey,
      avgValue20d_VND: r.avgValue20Vnd,
      latestClose: r.latestClose,
      avgVol20d: r.avgVol20,
    })),
    top20By20dAvgVolume: byVol.slice(0, 20).map((r) => ({
      symbol: r.symbolKey,
      avgVol20d: r.avgVol20,
      avgValue20d_VND: r.avgValue20Vnd,
      latestClose: r.latestClose,
    })),
    symbolsFailingEachTradabilityReason: byReason,
    examplesSingleReasonFailure: singleByReason,
    passedTradability: rows.filter((r) => r.result.passed).map((r) => r.symbolKey),
  };

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
