/**
 * READ-ONLY post-import verification for the backfill. Writes nothing to the
 * database; the only output is a verdict artifact.
 *
 * It answers two questions that fail differently, and both must pass:
 *   - did anything get LOST (Gate 1 baseline invariants)
 *   - did we actually GAIN what the verified fetch contained (coverage)
 * A run that loses nothing and imports nothing satisfies the first perfectly,
 * which is exactly why the second exists.
 *
 * Every artifact it consults is fingerprinted into the report, so a verdict is
 * tied to specific bytes rather than to filenames that may since have changed.
 *
 * Usage:
 *   npx tsx scripts/backfill/verify-backfill.ts \
 *     --baseline-before docs/trading/backfill-8y/baseline-before.json \
 *     --manifest manifest.json --import-report import-report.json \
 *     --out docs/trading/backfill-8y/verification.json
 */
import "../load-env";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import {
  buildBarBaseline,
  encodeDayBitmap,
  findMissingBitmaps,
  type BarBaseline,
  type YearDayBitmaps,
} from "../../src/lib/ops/bar-baseline";
import type { FetchManifest } from "../../src/lib/ops/fetch-manifest";
import {
  buildVerificationReport,
  formatVerificationReport,
} from "../../src/lib/ops/backfill-verify";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function toBitmaps(yearDays: Record<string, number[]> | null): YearDayBitmaps {
  const out: YearDayBitmaps = {};
  for (const [year, days] of Object.entries(yearDays ?? {})) out[year] = encodeDayBitmap(days ?? []);
  return out;
}

/** Same shape as snapshot-bar-baseline, so before/after are directly comparable. */
async function captureBaseline(): Promise<BarBaseline> {
  const [symbolRows, indexRows] = await Promise.all([
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
             (select jsonb_object_agg(py.yr::text, py.yr_md5) from per_year py where py.symbol = s.symbol) as year_checksums,
             (select jsonb_object_agg(py.yr::text, py.yr_rows) from per_year py where py.symbol = s.symbol) as year_bar_counts,
             (select jsonb_object_agg(py.yr::text, py.yr_days) from per_year py where py.symbol = s.symbol) as year_days,
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
             (select jsonb_object_agg(py.yr::text, py.yr_md5) from per_year py where py.symbol = i.symbol) as year_checksums,
             (select jsonb_object_agg(py.yr::text, py.yr_rows) from per_year py where py.symbol = i.symbol) as year_bar_counts,
             (select jsonb_object_agg(py.yr::text, py.yr_days) from per_year py where py.symbol = i.symbol) as year_days
      from index_daily_bars i group by i.symbol order by i.symbol
    `,
  ]);

  return buildBarBaseline({
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
}

/**
 * Recompute, from the database, the same canonical checksum the fetcher wrote —
 * restricted to exactly the dates that were fetched, so pre-existing rows outside
 * the window cannot mask or corrupt the comparison. Fixed 6-decimal rendering on
 * both sides so Postgres float formatting and Python's agree.
 */
async function storedValueChecksums(
  manifest: FetchManifest
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const m of manifest.perSymbol) {
    const dates: string[] = [];
    for (const [year, days] of Object.entries(m.yearDays ?? {})) {
      for (const doy of days ?? []) {
        const d = new Date(Date.UTC(Number(year), 0, 1));
        d.setUTCDate(doy);
        dates.push(d.toISOString().slice(0, 10));
      }
    }
    if (dates.length === 0) {
      out[m.symbol] = null;
      continue;
    }
    const rows = await prisma.$queryRaw<Array<{ md5: string | null }>>`
      select md5(string_agg(line, E'
' order by line)) as md5
      from (
        select b.date::text || '|' ||
               to_char(round(b.open::numeric, 6),   'FM9999999990.000000') || '|' ||
               to_char(round(b.high::numeric, 6),   'FM9999999990.000000') || '|' ||
               to_char(round(b.low::numeric, 6),    'FM9999999990.000000') || '|' ||
               to_char(round(b.close::numeric, 6),  'FM9999999990.000000') || '|' ||
               to_char(round(b.volume::numeric, 6), 'FM9999999990.000000') as line
        from stock_daily_bars b
        join stock_symbols s on s.id = b.symbol_id
        where s.symbol = ${m.symbol} and b.date = ANY(${dates}::date[])
      ) t
    `;
    out[m.symbol] = rows[0]?.md5 ?? null;
  }
  return out;
}

async function main(): Promise<void> {
  const beforePath = arg("baseline-before");
  const manifestPath = arg("manifest");
  const importReportPath = arg("import-report");
  const outPath = arg("out");
  const afterOutPath = arg("baseline-after-out");
  const convergencePath = arg("convergence-baseline");

  if (!beforePath || !manifestPath || !importReportPath) {
    throw new Error("--baseline-before, --manifest and --import-report are all required");
  }

  console.error(`verify-backfill → DATABASE_URL: ${describeDatabaseUrl()} (read-only)`);

  const before = JSON.parse(readFileSync(beforePath, "utf8")) as BarBaseline;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FetchManifest;
  const importReport = JSON.parse(readFileSync(importReportPath, "utf8")) as {
    dryRun?: boolean;
    inputSha256?: string;
  };

  const after = await captureBaseline();

  // Without bitmaps the date-loss test silently degrades to "assume benign", so
  // a verdict computed from such a snapshot would be worthless.
  const gaps = [...findMissingBitmaps(before), ...findMissingBitmaps(after)];
  if (gaps.length > 0) {
    throw new Error(
      `${gaps.length} year(s) lack a day bitmap (e.g. ${gaps.slice(0, 3).join(", ")}); ` +
        `date-loss detection is not provable. Re-capture the baseline with the current script.`
    );
  }

  const report = buildVerificationReport(
    {
      before,
      after,
      manifest,
      importWasDryRun: importReport.dryRun === true,
      storedValueChecksums: await storedValueChecksums(manifest),
      convergenceBaseline: convergencePath
        ? (JSON.parse(readFileSync(convergencePath, "utf8")) as BarBaseline)
        : undefined,
      fingerprints: {
        runId: randomUUID(),
        database: describeDatabaseUrl(),
        baselineBefore: sha256(beforePath),
        manifest: sha256(manifestPath),
        importReport: sha256(importReportPath),
        importInput: importReport.inputSha256 ?? "(absent)",
        convergenceBaseline: convergencePath ? sha256(convergencePath) : "(not checked)",
      },
    },
    new Date().toISOString()
  );

  console.log(formatVerificationReport(report));

  if (afterOutPath) {
    mkdirSync(dirname(afterOutPath), { recursive: true });
    writeFileSync(afterOutPath, JSON.stringify(after, null, 2), "utf8");
    console.error(`Wrote post-import baseline to ${afterOutPath}`);
  }
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.error(`Wrote verification report to ${outPath}`);
  }

  // Exit code is the machine-readable verdict.
  if (report.verdict !== "GO") process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("verify-backfill FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
