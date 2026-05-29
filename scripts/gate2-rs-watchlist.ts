/**
 * Diagnostic-only relative-strength near-miss watchlist (INVALID + RS20>0).
 * Does not persist data or change Gate 2 pass/fail, rankScore, or production scanner.
 *
 * Usage:
 *   npx tsx scripts/gate2-rs-watchlist.ts
 *   npx tsx scripts/gate2-rs-watchlist.ts --json
 *   npx tsx scripts/gate2-rs-watchlist.ts --limit=15
 *   npx tsx scripts/gate2-rs-watchlist.ts --forward
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { describeDatabaseUrl } from "./load-env";
import { computeForwardReturnLabels } from "../src/lib/scanner/gate2/forward-returns";
import {
  computeRsNearMissWatchlistFromDb,
  RS_NEAR_MISS_WATCHLIST_DISCLAIMER,
  RS_NEAR_MISS_WATCHLIST_SORT_DOC,
  type RsNearMissWatchlistRow,
} from "../src/lib/scanner/gate2/rs-near-miss-watchlist";
import { sortDedupeGate2Bars } from "../src/lib/scanner/gate2/breakout-pullback";

function parseLimit(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--limit="));
  if (!raw) return 20;
  const n = Number.parseInt(raw.slice("--limit=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 20;
}

function pad(s: string, w: number): string {
  const t = s.length > w ? `${s.slice(0, w - 1)}…` : s;
  return t.padEnd(w, " ");
}

function formatRow(
  r: RsNearMissWatchlistRow,
  forward20: number | null | undefined
): string {
  const dist =
    r.distanceToPullbackZoneFrac != null && Number.isFinite(r.distanceToPullbackZoneFrac)
      ? r.distanceToPullbackZoneFrac.toFixed(4)
      : "-";
  const fwd =
    forward20 != null && Number.isFinite(forward20) ? `${forward20.toFixed(2)}%` : "-";
  return `${pad(r.symbol, 8)}${pad(r.sessionDate, 12)}${pad(
    `+${r.rs20SpreadPct.toFixed(2)}`,
    8
  )}${pad(r.rs50SpreadPct != null ? r.rs50SpreadPct.toFixed(2) : "-", 8)}${pad(
    r.terminalCode ?? "-",
    28
  )}${pad(dist, 8)}${pad(String(r.stageRank), 6)}${pad(fwd, 8)}`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const asJson = argv.includes("--json");
  const withForward = argv.includes("--forward");

  console.error(RS_NEAR_MISS_WATCHLIST_DISCLAIMER);
  console.error(`Sort: ${RS_NEAR_MISS_WATCHLIST_SORT_DOC}`);
  console.error(`DB: ${describeDatabaseUrl()}`);

  const { expectedLatestSession, tradabilityPassedCount, rows } =
    await computeRsNearMissWatchlistFromDb(prisma, { limit });

  const forwardBySymbol = new Map<string, number | null>();
  if (withForward) {
    for (const row of rows) {
      const sym = await prisma.stockSymbol.findUnique({
        where: { symbol: row.symbol },
        select: { id: true },
      });
      if (!sym) continue;
      const barRows = await prisma.stockDailyBar.findMany({
        where: { symbolId: sym.id },
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
      const labels = computeForwardReturnLabels(
        sortDedupeGate2Bars(barRows),
        expectedLatestSession
      );
      forwardBySymbol.set(row.symbol, labels?.forwardReturnPct[20] ?? null);
    }
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          disclaimer: RS_NEAR_MISS_WATCHLIST_DISCLAIMER,
          sort: RS_NEAR_MISS_WATCHLIST_SORT_DOC,
          sessionDate: expectedLatestSession.toISOString(),
          tradabilityPassedCount,
          rows: rows.map((r) => ({
            ...r,
            forwardReturn20dPct: withForward
              ? (forwardBySymbol.get(r.symbol) ?? null)
              : undefined,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Session: ${expectedLatestSession.toISOString().slice(0, 10)}`);
  console.log(`Tradable universe: ${tradabilityPassedCount} · watchlist rows: ${rows.length}`);
  console.log(
    `${pad("symbol", 8)}${pad("session", 12)}${pad("RS20", 8)}${pad("RS50", 8)}${pad(
      "terminalCode",
      28
    )}${pad("distZn", 8)}${pad("stage", 6)}${withForward ? pad("fwd20%", 8) : ""}`
  );
  console.log("-".repeat(withForward ? 96 : 88));
  for (const r of rows) {
    console.log(formatRow(r, withForward ? forwardBySymbol.get(r.symbol) : undefined));
    console.log(`  ${r.failedGate2Because}`);
    if (r.topRejectionReason) console.log(`  ${r.topRejectionReason}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
