/**
 * Add or reactivate tactical symbols (operator CLI).
 *
 * Usage:
 *   npx tsx scripts/add-tactical-symbols.ts GEX GEE --source=manual --expires-days=14 --note="hot breakout watch"
 *   npx tsx scripts/add-tactical-symbols.ts GEX --create-missing
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import {
  computeExpiry,
  normalizeUniqueSymbols,
  parseAddTacticalCliOptions,
} from "../src/lib/tactical-universe-ops";
import { describeDatabaseUrl } from "./load-env";

type Action = "added" | "reactivated_or_updated" | "skipped_missing_stock_symbol";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const rawSymbols = argv.filter((a) => !a.startsWith("--"));
  if (rawSymbols.length === 0) {
    throw new Error(
      "Provide at least one symbol. Example: npx tsx scripts/add-tactical-symbols.ts GEX GEE --source=manual --expires-days=14"
    );
  }

  const opts = parseAddTacticalCliOptions(argv);
  const symbols = normalizeUniqueSymbols(rawSymbols);
  const now = new Date();
  const expiresAt = computeExpiry(now, opts.expiresDays);

  console.error("add-tactical-symbols.ts → DATABASE_URL:", describeDatabaseUrl());
  console.error(
    JSON.stringify(
      {
        symbolsRequested: symbols.length,
        source: opts.source,
        expiresDays: opts.expiresDays,
        createMissing: opts.createMissing,
      },
      null,
      2
    )
  );

  let added = 0;
  let reactivatedOrUpdated = 0;
  const skippedMissing: string[] = [];
  const perSymbol: Array<{ symbol: string; action: Action; expiresAt: string }> = [];

  for (const symbol of symbols) {
    const stock = await prisma.stockSymbol.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!stock && !opts.createMissing) {
      skippedMissing.push(symbol);
      perSymbol.push({
        symbol,
        action: "skipped_missing_stock_symbol",
        expiresAt: expiresAt.toISOString(),
      });
      continue;
    }

    if (!stock && opts.createMissing) {
      await prisma.stockSymbol.create({
        data: { symbol, active: false },
      });
    }

    const existsActive = await prisma.tacticalSymbol.findUnique({
      where: { symbol_status: { symbol, status: "ACTIVE" } },
      select: { id: true },
    });

    await prisma.tacticalSymbol.upsert({
      where: { symbol_status: { symbol, status: "ACTIVE" } },
      create: {
        symbol,
        status: "ACTIVE",
        source: opts.source,
        reasonNote: opts.note ?? undefined,
        activeForScanner: true,
        expiresAt,
      },
      update: {
        source: opts.source,
        reasonNote: opts.note ?? undefined,
        activeForScanner: true,
        expiresAt,
      },
    });

    if (existsActive) {
      reactivatedOrUpdated++;
      perSymbol.push({
        symbol,
        action: "reactivated_or_updated",
        expiresAt: expiresAt.toISOString(),
      });
    } else {
      added++;
      perSymbol.push({
        symbol,
        action: "added",
        expiresAt: expiresAt.toISOString(),
      });
    }
  }

  const summary = {
    added,
    reactivatedOrUpdated,
    skippedMissingSymbols: skippedMissing,
    expiresAt: expiresAt.toISOString(),
    symbolsProcessed: perSymbol,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
