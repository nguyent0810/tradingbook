/**
 * READ-ONLY: freezes the universe for the forward out-of-sample holdout.
 *
 * A forward test is only out-of-sample if the universe is fixed before the
 * outcomes exist. Two leaks have to be closed at the same time:
 *
 *   - symbols added to the registry later would arrive already curated by how
 *     they performed, so the snapshot records exactly who is eligible today;
 *   - a newly added symbol gets its full prehistory backfilled on import, so the
 *     snapshot also records each symbol's last stored bar, and the protocol
 *     counts a symbol only from that date forward.
 *
 * Writes docs/trading/replay/oos/universe-snapshot-<date>.json. Run once. If it
 * is ever run again the protocol is broken, not refreshed.
 *
 *   npx tsx scripts/replay/snapshot-forward-oos-universe.ts
 */
import "../load-env";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.error(`  ${label}: attempt ${i + 1} failed, retrying`);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

async function main(): Promise<void> {
  console.error(`snapshot-forward-oos-universe → ${describeDatabaseUrl()} (read-only)`);

  const rows = await withRetry("registry", () =>
    prisma.$queryRawUnsafe<any[]>(
      `select s.symbol, s.exchange, s.active,
              min(b.date) as first_bar, max(b.date) as last_bar, count(b.id)::int as bars
       from stock_symbols s left join stock_daily_bars b on b.symbol_id = s.id
       group by s.symbol, s.exchange, s.active
       order by s.symbol`,
    ),
  );

  const withBars = rows.filter((r) => r.bars > 0);
  const asOf = withBars.reduce(
    (mx, r) => (isoDay(r.last_bar) > mx ? isoDay(r.last_bar) : mx),
    "0000-00-00",
  );

  const snapshot = {
    purpose: "frozen universe for the forward out-of-sample holdout",
    frozenAt: asOf,
    strategySha: "4762d10",
    rule:
      "A symbol is eligible for the forward holdout only from the day after `asOf`, " +
      "and only if it appears in `symbols` below. Symbols added to the registry later " +
      "are excluded for the whole holdout, and no backfilled prehistory of any symbol " +
      "counts. Point-in-time universe resolution still applies within this set.",
    registryRows: rows.length,
    symbolsWithBars: withBars.length,
    symbols: withBars.map((r) => ({
      symbol: r.symbol,
      exchange: r.exchange ?? null,
      firstBar: isoDay(r.first_bar),
      lastBar: isoDay(r.last_bar),
      bars: r.bars,
    })),
  };

  const dir = "docs/trading/replay/oos";
  mkdirSync(dir, { recursive: true });
  const out = `${dir}/universe-snapshot-${asOf}.json`;
  if (existsSync(out)) {
    console.error(`REFUSING to overwrite ${out} — the snapshot is frozen by design.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  writeFileSync(out, JSON.stringify(snapshot, null, 1));
  console.log(`wrote ${out}`);
  console.log(`  frozenAt=${asOf} registryRows=${rows.length} withBars=${withBars.length}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
