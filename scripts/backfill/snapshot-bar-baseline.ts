/**
 * READ-ONLY baseline snapshot of stored equity/index bars.
 *
 * Run before a backfill and again after, then `--compare` the two. The point is
 * to prove what a backfill changed rather than assert it: bar counts per symbol,
 * date span, and a full-row md5 per calendar year (date, open, high, low, close,
 * volume, source) so a silent value rewrite — a corporate-action re-basing, say —
 * shows up even when the row count is identical.
 *
 * `--compare` exits non-zero on data loss (bars lost, symbol vanished, newest bar
 * regressed) so an ops step wrapping it cannot report success.
 *
 * Artifacts belong under `docs/trading/backfill-8y/`, not `reports/`, because
 * `/reports/` is gitignored and this is the rollback evidence for a production
 * rewrite — it has to survive off this machine.
 *
 * Usage:
 *   npx tsx scripts/backfill/snapshot-bar-baseline.ts --out docs/trading/backfill-8y/baseline-before.json
 *   npx tsx scripts/backfill/snapshot-bar-baseline.ts --compare docs/trading/backfill-8y/baseline-before.json --out docs/trading/backfill-8y/baseline-after.json
 *
 * Writes nothing to the database.
 */
import "../load-env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import {
  buildBarBaseline,
  compareBarBaselines,
  formatBaselineComparison,
  hasDataLoss,
  findMissingBitmaps,
  encodeDayBitmap,
  type BarBaseline,
  type YearDayBitmaps,
} from "../../src/lib/ops/bar-baseline";

/**
 * Day-of-year arrays cross the wire (compact: one small int per stored bar) and
 * are folded into 46-byte bitmaps here, so the committed artifact stays small
 * while the comparison keeps exact date-set semantics.
 */
function toBitmaps(yearDays: Record<string, number[]> | null): YearDayBitmaps {
  const out: YearDayBitmaps = {};
  for (const [year, days] of Object.entries(yearDays ?? {})) {
    out[year] = encodeDayBitmap(days ?? []);
  }
  return out;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const outPath = arg("out");
  const comparePath = arg("compare");

  console.error(`snapshot-bar-baseline → DATABASE_URL: ${describeDatabaseUrl()}`);

  const [symbolRows, indexRows] = await Promise.all([
    // Full-row checksums bucketed by calendar year. A recent-window, close-only
    // checksum would be blind to exactly what a 9-year upsert-with-update
    // rewrites; year buckets stay bounded while pinpointing what changed.
    prisma.$queryRaw<
      Array<{
        symbol: string;
        bar_count: bigint;
        min_date: Date | null;
        max_date: Date | null;
        year_checksums: Record<string, string> | null;
        year_bar_counts: Record<string, number> | null;
        year_days: Record<string, number[]> | null;
        stale_90d: bigint;
      }>
    >`
      with per_year as (
        select s.symbol,
               extract(year from b.date)::int as yr,
               md5(string_agg(
                 b.date::text || '|' || b.open::text || '|' || b.high::text || '|' ||
                 b.low::text  || '|' || b.close::text || '|' || b.volume::text || '|' ||
                 coalesce(b.source, ''),
                 ',' order by b.date
               )) as yr_md5,
               count(*) as yr_rows,
               array_agg(extract(doy from b.date)::int order by b.date) as yr_days
        from stock_symbols s
        join stock_daily_bars b on b.symbol_id = s.id
        where s.active
        group by s.symbol, extract(year from b.date)
      )
      select s.symbol,
             count(b.id) as bar_count,
             min(b.date) as min_date,
             max(b.date) as max_date,
             (select jsonb_object_agg(py.yr::text, py.yr_md5)
                from per_year py where py.symbol = s.symbol) as year_checksums,
             (select jsonb_object_agg(py.yr::text, py.yr_rows)
                from per_year py where py.symbol = s.symbol) as year_bar_counts,
             (select jsonb_object_agg(py.yr::text, py.yr_days)
                from per_year py where py.symbol = s.symbol) as year_days,
             count(b.id) filter (where b.updated_at::date < current_date - 90) as stale_90d
      from stock_symbols s
      left join stock_daily_bars b on b.symbol_id = s.id
      where s.active
      group by s.symbol
      order by s.symbol
    `,
    prisma.$queryRaw<
      Array<{
        symbol: string;
        bar_count: bigint;
        min_date: Date | null;
        max_date: Date | null;
        year_checksums: Record<string, string> | null;
        year_bar_counts: Record<string, number> | null;
        year_days: Record<string, number[]> | null;
      }>
    >`
      with per_year as (
        select symbol,
               extract(year from date)::int as yr,
               md5(string_agg(
                 date::text || '|' || open::text || '|' || high::text || '|' ||
                 low::text  || '|' || close::text || '|' || volume::text || '|' ||
                 coalesce(source, ''),
                 ',' order by date
               )) as yr_md5,
               count(*) as yr_rows,
               array_agg(extract(doy from date)::int order by date) as yr_days
        from index_daily_bars group by symbol, extract(year from date)
      )
      select i.symbol, count(*) as bar_count, min(i.date) as min_date, max(i.date) as max_date,
             (select jsonb_object_agg(py.yr::text, py.yr_md5)
                from per_year py where py.symbol = i.symbol) as year_checksums,
             (select jsonb_object_agg(py.yr::text, py.yr_rows)
                from per_year py where py.symbol = i.symbol) as year_bar_counts,
             (select jsonb_object_agg(py.yr::text, py.yr_days)
                from per_year py where py.symbol = i.symbol) as year_days
      from index_daily_bars i group by i.symbol order by i.symbol
    `,
  ]);

  const baseline = buildBarBaseline({
    capturedAt: new Date().toISOString(),
    databaseHint: describeDatabaseUrl(),
    symbolRows: symbolRows.map((r) => ({
      symbol: r.symbol,
      barCount: Number(r.bar_count),
      minDate: r.min_date ? r.min_date.toISOString().slice(0, 10) : null,
      maxDate: r.max_date ? r.max_date.toISOString().slice(0, 10) : null,
      yearChecksums: r.year_checksums ?? {},
      yearBarCounts: r.year_bar_counts ?? {},
      yearDayBitmaps: toBitmaps(r.year_days),
      staleBars90d: Number(r.stale_90d),
    })),
    indexRows: indexRows.map((r) => ({
      symbol: r.symbol,
      barCount: Number(r.bar_count),
      minDate: r.min_date ? r.min_date.toISOString().slice(0, 10) : null,
      maxDate: r.max_date ? r.max_date.toISOString().slice(0, 10) : null,
      yearChecksums: r.year_checksums ?? {},
      yearBarCounts: r.year_bar_counts ?? {},
      yearDayBitmaps: toBitmaps(r.year_days),
    })),
  });

  console.error(
    `symbols=${baseline.totals.symbols} equityBars=${baseline.totals.equityBars} ` +
      `indexBars=${baseline.totals.indexBars} staleBars90d=${baseline.totals.staleBars90d} ` +
      `medianBarsPerSymbol=${baseline.totals.medianBarsPerSymbol}`
  );

  if (comparePath) {
    const before = JSON.parse(readFileSync(comparePath, "utf8")) as BarBaseline;

    // A snapshot without day bitmaps cannot prove anything: the subset test
    // silently degrades to "assume benign". Refuse rather than pretend.
    const gaps = [...findMissingBitmaps(before), ...findMissingBitmaps(baseline)];
    if (gaps.length > 0) {
      console.error(
        `REFUSING TO COMPARE — ${gaps.length} year(s) lack a day bitmap, so date-loss ` +
          `detection is not provable. First few: ${gaps.slice(0, 5).join(", ")}. ` +
          `Re-capture both snapshots with the current script.`
      );
      process.exitCode = 1;
      return;
    }

    const cmp = compareBarBaselines(before, baseline);
    console.log(formatBaselineComparison(cmp));
    if (hasDataLoss(cmp)) {
      // Exit non-zero so a CI/ops step around this cannot report success.
      process.exitCode = 1;
    }
  }

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(baseline, null, 2), "utf8");
    console.error(`Wrote baseline to ${outPath}`);
  } else if (!comparePath) {
    console.log(JSON.stringify(baseline, null, 2));
  }
}

main()
  .catch((e) => {
    console.error("snapshot-bar-baseline FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
