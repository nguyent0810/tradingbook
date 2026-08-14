/**
 * READ-ONLY: §0 probe — how much of today's listed market has never been fetched?
 *
 * Eleven phases scanned whatever symbols have bars in this database. If the
 * exchange listing is much larger than that, the unfetched remainder is a
 * cross-sectional gap: same calendar period, different symbols. That is NOT
 * out-of-sample for a hypothesis discovered on this period, but it bears on the
 * power ceiling, so §0 has to name it rather than leave it implicit.
 *
 *   npx tsx scripts/replay/audit-oos-universe-gap.ts --listing <csv>
 */
import "../load-env";
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

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
  const listingPath = arg("listing");
  if (!listingPath) throw new Error("--listing <csv> required (symbol,exchange,type)");
  console.error(`audit-oos-universe-gap → ${describeDatabaseUrl()} (read-only)`);

  const lines = readFileSync(listingPath, "utf-8").trim().split(/\r?\n/);
  const header = lines[0]!.split(",");
  const iSym = header.indexOf("symbol");
  const iExch = header.indexOf("exchange");
  const listing = lines.slice(1).map((l) => {
    const c = l.split(",");
    return { symbol: c[iSym]!.trim().toUpperCase(), exchange: (c[iExch] ?? "").trim() };
  });

  const withBars = await withRetry("withBars", () =>
    prisma.$queryRawUnsafe<any[]>(
      `select s.symbol, min(b.date) as mn, max(b.date) as mx, count(*)::int as bars
       from stock_symbols s join stock_daily_bars b on b.symbol_id = s.id
       group by s.symbol order by s.symbol`,
    ),
  );
  const have = new Map(withBars.map((r) => [String(r.symbol).toUpperCase(), r]));
  console.log(`listing stocks = ${listing.length} · symbols with bars in DB = ${have.size}`);

  const byExch = new Map<string, { total: number; fetched: number }>();
  for (const l of listing) {
    const k = l.exchange || "(none)";
    const e = byExch.get(k) ?? { total: 0, fetched: 0 };
    e.total++;
    if (have.has(l.symbol)) e.fetched++;
    byExch.set(k, e);
  }
  console.log("\nexchange   listedToday   fetched   neverFetched   fetchedShare");
  for (const [k, e] of [...byExch.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(
      `${k.padEnd(9)}  ${String(e.total).padStart(11)}  ${String(e.fetched).padStart(8)}  ${String(e.total - e.fetched).padStart(13)}  ${((100 * e.fetched) / e.total).toFixed(1).padStart(11)}%`,
    );
  }

  // Symbols the database holds that today's listing no longer contains — these
  // are the delisted names the research sample did see, and their count bounds
  // how much delisting the in-sample universe already absorbs.
  const listedSet = new Set(listing.map((l) => l.symbol));
  const goneFromListing = [...have.keys()].filter((s) => !listedSet.has(s));
  console.log(`\nin DB but absent from today's listing: ${goneFromListing.length}`);
  console.log(`  ${goneFromListing.slice(0, 40).join(" ")}`);

  const never = listing.filter((l) => !have.has(l.symbol)).map((l) => l.symbol);
  writeFileSync("docs/trading/replay/oos/never-fetched-symbols.json", JSON.stringify(never, null, 1));
  console.log(`\nwrote oos-never-fetched-symbols.json (${never.length})`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
