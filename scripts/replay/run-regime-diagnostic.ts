/**
 * READ-ONLY diagnostic: what changed between 2015-2021 and 2022-2026?
 *
 * The baseline replay answers "did it work". It cannot answer "why did it stop
 * working", because its output only contains setups that survived Gate 2 and
 * Gate 1. Three different failures — setups stopped forming, stopped being
 * surfaced, or stopped paying — are indistinguishable from the signals alone.
 *
 * So this run records EVERY session: the regime, the index's own volatility, how
 * many symbols were tradable, how many Gate 2 candidates formed, why the rest
 * were rejected, and the geometry of each candidate that did form. Plus market
 * breadth, computed from the same bars, which Gate 1 never looks at.
 *
 * Nothing here feeds a decision. No parameter is changed.
 *
 *   npx tsx scripts/replay/run-regime-diagnostic.ts --out docs/trading/replay/regime
 */
import "../load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { runReplay, type SymbolSeries, type SessionDiagnostic } from "../../src/lib/replay/replay-engine";
import type { TradeBar } from "../../src/lib/replay/trade-model";
import type { TacticalWindowRow } from "../../src/lib/replay/point-in-time-universe";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function main(): Promise<void> {
  const outDir = arg("out") ?? "docs/trading/replay/regime";
  console.error(`run-regime-diagnostic → ${describeDatabaseUrl()} (read-only)`);

  const [symbolRows, indexRows, tacticalRows] = await Promise.all([
    prisma.stockSymbol.findMany({ select: { id: true, symbol: true }, orderBy: { symbol: "asc" } }),
    prisma.indexDailyBar.findMany({
      where: { symbol: "VNINDEX" },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      orderBy: { date: "asc" },
    }),
    prisma.tacticalSymbol.findMany({
      select: { symbol: true, addedAt: true, expiresAt: true, status: true, activeForScanner: true },
    }),
  ]);

  const series: SymbolSeries[] = [];
  let loaded = 0;
  for (const s of symbolRows) {
    const bars = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
      select: { date: true, open: true, high: true, low: true, close: true, volume: true },
      orderBy: { date: "asc" },
    });
    series.push({ symbolId: s.id, symbol: s.symbol, bars: bars as TradeBar[] });
    loaded += bars.length;
    if (series.length % 200 === 0) console.error(`  loaded ${series.length}/${symbolRows.length}`);
  }
  console.error(`loaded ${loaded} bars`);

  const tactical: TacticalWindowRow[] = tacticalRows.map((t) => ({
    symbol: t.symbol,
    addedAt: t.addedAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    status: String(t.status),
    activeForScanner: t.activeForScanner,
  }));

  const sessions: SessionDiagnostic[] = [];
  const result = runReplay({
    series,
    indexBars: indexRows as TradeBar[],
    tactical,
    options: { progressEvery: 400 },
    onSession: (d) => sessions.push(d),
    onProgress: (done, total) => console.error(`  session ${done}/${total}`),
  });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/sessions.ndjson`, sessions.map((s) => JSON.stringify(s)).join("\n") + "\n", "utf8");
  console.error(`wrote ${sessions.length} session rows`);

  // ---- Breadth, and what actually led the market ----
  //
  // Gate 1 reads the index alone. Breadth (how many names participate) and
  // leadership (which names carry the move) are invisible to it, and both are
  // candidate explanations for a regime that stopped paying. Computed here from
  // the same bars, on the same session calendar.
  const closesBySymbol = new Map<string, { dates: number[]; closes: number[] }>();
  for (const s of series) {
    if (s.bars.length < 60) continue;
    closesBySymbol.set(s.symbol, {
      dates: s.bars.map((b) => b.date.getTime()),
      closes: s.bars.map((b) => b.close),
    });
  }

  const breadth: Array<{ sessionDate: string; n: number; pctAboveMa50: number; pctUp20d: number }> = [];
  const idxDates = indexRows.map((b) => b.date.getTime());
  for (let i = 0; i < idxDates.length; i += 5) {
    // Every 5th session: breadth moves slowly and the full grid is 4,000 x 1,500.
    const t = idxDates[i]!;
    let n = 0;
    let above = 0;
    let up20 = 0;
    for (const [, sc] of closesBySymbol) {
      let hi = sc.dates.length - 1;
      let lo = 0;
      let end = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sc.dates[mid]! <= t) {
          end = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (end < 50) continue;
      n++;
      const c = sc.closes[end]!;
      const ma50 = sc.closes.slice(end - 49, end + 1).reduce((a, x) => a + x, 0) / 50;
      if (c > ma50) above++;
      const prior = sc.closes[end - 20];
      if (prior != null && c > prior) up20++;
    }
    if (n > 0) {
      breadth.push({
        sessionDate: isoDay(new Date(t)),
        n,
        pctAboveMa50: Number(((above / n) * 100).toFixed(2)),
        pctUp20d: Number(((up20 / n) * 100).toFixed(2)),
      });
    }
  }
  writeFileSync(`${outDir}/breadth.ndjson`, breadth.map((b) => JSON.stringify(b)).join("\n") + "\n", "utf8");
  console.error(`wrote ${breadth.length} breadth rows`);

  // ---- Leadership: the biggest movers per period, and their setup geometry ----
  //
  // Q: are post-2022 winners a shape this playbook cannot see? Ranking every
  // symbol by realised move per period says what leadership looked like; the
  // signals dump says whether the scanner ever surfaced it.
  const periods: Array<[string, string, string]> = [
    ["2015-2021", "2015-01-01", "2021-12-31"],
    ["2022-2026", "2022-01-01", "2026-12-31"],
  ];
  const leaders: Record<string, Array<{ symbol: string; retPct: number; maxDrawdownPct: number; barsHeld: number }>> = {};
  for (const [label, from, to] of periods) {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    const rows: Array<{ symbol: string; retPct: number; maxDrawdownPct: number; barsHeld: number }> = [];
    for (const s of series) {
      const win = s.bars.filter((b) => b.date.getTime() >= fromMs && b.date.getTime() <= toMs);
      if (win.length < 200) continue;
      const first = win[0]!.close;
      const last = win[win.length - 1]!.close;
      let peak = -Infinity;
      let maxDd = 0;
      for (const b of win) {
        peak = Math.max(peak, b.close);
        maxDd = Math.min(maxDd, ((b.close - peak) / peak) * 100);
      }
      rows.push({
        symbol: s.symbol,
        retPct: Number((((last - first) / first) * 100).toFixed(2)),
        maxDrawdownPct: Number(maxDd.toFixed(2)),
        barsHeld: win.length,
      });
    }
    rows.sort((a, b) => b.retPct - a.retPct);
    leaders[label] = rows;
  }
  writeFileSync(`${outDir}/leaders.json`, JSON.stringify(leaders, null, 2), "utf8");
  console.error(`wrote leadership for ${Object.keys(leaders).join(", ")}`);

  console.error(`guardViolations=${result.guardViolations}`);
  if (result.guardViolations > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("run-regime-diagnostic FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
