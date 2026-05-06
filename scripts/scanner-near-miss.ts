/**
 * Read-only Gate 2 near-miss watchlist (tradable symbols, INVALID sorted by pipeline depth).
 * Does not persist SetupCandidate rows or change the daily scanner.
 *
 * Usage:
 *   npx tsx scripts/scanner-near-miss.ts
 *   npx tsx scripts/scanner-near-miss.ts --json
 *   npx tsx scripts/scanner-near-miss.ts --limit=30
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import {
  computeNearMissWatchlistFromDb,
  NEAR_MISS_WATCHLIST_DISCLAIMER,
  type NearMissWatchlistRow,
} from "../src/lib/scanner/near-miss-watchlist";
import { describeDatabaseUrl } from "./load-env";

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

function formatNum(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

function printTable(rows: NearMissWatchlistRow[]): void {
  const header = `${pad("symbol", 8)}${pad("stage", 6)}${pad("terminalCategory", 24)}${pad(
    "watchlistHint",
    34
  )}${pad("close", 8)}${pad("ma20", 8)}${pad("ma50", 8)}${pad("distZn", 8)}${pad("risk%", 7)}`;
  console.log(header);
  console.log("-".repeat(Math.min(header.length, 140)));
  for (const r of rows) {
    const risk =
      r.riskToStopFrac != null ? `${(100 * r.riskToStopFrac).toFixed(1)}%` : "-";
    const m20 = r.ma20 != null ? String(Number(r.ma20.toFixed(2))) : "-";
    const m50 = r.ma50 != null ? String(Number(r.ma50.toFixed(2))) : "-";
    console.log(
      `${pad(r.symbol, 8)}${pad(String(r.stageRank), 6)}${pad(r.terminalCategory, 24)}${pad(
        r.watchlistDiagnosticCategory,
        34
      )}${pad(String(r.close), 8)}${pad(m20, 8)}${pad(m50, 8)}${pad(formatNum(r.distanceToPullbackZoneFrac, 4), 8)}${pad(risk, 7)}`
    );
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limit = parseLimit(argv);
  const asJson = argv.includes("--json");

  console.error("scanner-near-miss.ts → DATABASE_URL:", describeDatabaseUrl());
  console.error(NEAR_MISS_WATCHLIST_DISCLAIMER);

  const { rows, expectedLatestSession, tradabilityPassedCount } =
    await computeNearMissWatchlistFromDb(prisma, limit);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          disclaimer: NEAR_MISS_WATCHLIST_DISCLAIMER,
          generatedAt: new Date().toISOString(),
          expectedLatestSession: expectedLatestSession.toISOString(),
          tradabilityPassedCount,
          sortedBy: "pipelineStageRankDesc",
          limit,
          topNearMisses: rows,
        },
        null,
        2
      )
    );
    return;
  }

  console.log("");
  printTable(rows);
  console.log("");
  console.error(`Tradable symbols evaluated: ${tradabilityPassedCount}; rows shown: ${rows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
