/**
 * READ-ONLY pre-import check for a VNINDEX history backfill.
 *
 * `scripts/import-bars.ts` is upsert-only and never deletes, but it *skips*
 * duplicate dates and invalid bars rather than refusing the file. For a one-off
 * historical rewrite that is the wrong default: a silently skipped row is a hole
 * nobody sees. This runs first and aborts, so nothing is written when the
 * artifact is imperfect.
 *
 * Checks, all fatal:
 *   - any structurally invalid bar
 *   - any duplicate calendar date
 *   - the file's newest bar older than what is already stored (a regression)
 *   - the file covering less history than is already stored
 *   - the file's newest bar not being a settled session (today or later)
 *
 * Usage:
 *   npx tsx scripts/backfill/precheck-vnindex-backfill.ts --input vnindex.json
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { isoDay, utcDayFromMs, validateBar } from "../../src/lib/ops/backfill-import";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const inputPath = arg("input");
  const symbol = arg("symbol") ?? "VNINDEX";
  if (!inputPath) throw new Error("--input is required");

  console.error(`precheck-vnindex-backfill → DATABASE_URL: ${describeDatabaseUrl()} (read-only)`);

  const parsed = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Expected a non-empty JSON array in ${inputPath}`);
  }

  const problems: string[] = [];
  const seen = new Set<string>();
  const dates: string[] = [];

  parsed.forEach((raw, i) => {
    const v = validateBar(raw, i);
    if (!v.ok) {
      problems.push(`invalid bar ${v.reason}`);
      return;
    }
    const day = isoDay(utcDayFromMs(v.bar.time));
    if (seen.has(day)) problems.push(`duplicate date ${day}`);
    seen.add(day);
    dates.push(day);
  });

  dates.sort();
  const fileFirst = dates[0]!;
  const fileLast = dates[dates.length - 1]!;

  const stored = await prisma.indexDailyBar.aggregate({
    where: { symbol },
    _count: { _all: true },
    _min: { date: true },
    _max: { date: true },
  });
  const storedCount = stored._count._all;
  const storedFirst = stored._min.date ? stored._min.date.toISOString().slice(0, 10) : null;
  const storedLast = stored._max.date ? stored._max.date.toISOString().slice(0, 10) : null;

  if (storedLast && fileLast < storedLast) {
    problems.push(`newest bar regresses: file ends ${fileLast}, stored ends ${storedLast}`);
  }
  if (storedFirst && fileFirst > storedFirst) {
    problems.push(`file is shallower: starts ${fileFirst}, stored starts ${storedFirst}`);
  }

  const todayUtc = new Date().toISOString().slice(0, 10);
  if (fileLast >= todayUtc) {
    problems.push(`newest bar ${fileLast} is today or later — may be a provisional intraday bar`);
  }

  console.log(`=== VNINDEX backfill pre-check (${symbol}) ===`);
  console.log(`file:   ${parsed.length} bars, ${fileFirst} → ${fileLast}, ${seen.size} distinct dates`);
  console.log(`stored: ${storedCount} bars, ${storedFirst} → ${storedLast}`);
  console.log(`would add: ${seen.size - storedCount} bars (upsert only — nothing is deleted)`);

  if (problems.length > 0) {
    console.log("");
    console.log("!! REFUSING — fix the artifact before importing:");
    for (const p of problems.slice(0, 20)) console.log(`   ${p}`);
    if (problems.length > 20) console.log(`   … and ${problems.length - 20} more`);
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("no invalid bars, no duplicate dates, no regression, newest bar is settled — safe to import");
}

main()
  .catch((e) => {
    console.error("precheck-vnindex-backfill FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
