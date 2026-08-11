/**
 * Bulk importer for the 8-year backfill. Separate from `scripts/import-stock-bars.ts`
 * on purpose: the daily job must keep its behaviour exactly, and this path has
 * different failure modes.
 *
 * Two things it does that the daily importer cannot:
 *
 *  1. It REFUSES to write unless the fetch manifest reconciles against the Gate 1
 *     baseline. Every stored symbol must have been fetched, none empty, none
 *     shallower or staler than what is already on disk. Checking after the import
 *     means finding out from a corrupted database.
 *  2. It writes in batched multi-row upserts rather than one statement per bar.
 *     At ~570k rows the per-row path is ~36,000 sequential round trips; this is
 *     roughly 570.
 *
 * Reads NDJSON (one symbol per line) so peak memory is one symbol.
 *
 * Usage:
 *   npx tsx scripts/backfill/import-backfill-bars.ts \
 *     --input bars.ndjson --manifest manifest.json \
 *     --baseline docs/trading/backfill-8y/baseline-before.json [--dry-run]
 */
import "../load-env";
import { appendFileSync, createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { createHash, randomUUID } from "node:crypto";

import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import type { BarBaseline } from "../../src/lib/ops/bar-baseline";
import {
  fetchIsUnsafeToImport,
  formatReconciliation,
  reconcileFetchAgainstBaseline,
  type FetchManifest,
} from "../../src/lib/ops/fetch-manifest";
import {
  chunk,
  findDuplicateSymbols,
  formatInputReconciliation,
  inputMatchesManifest,
  isValidIsoDate,
  isoDay,
  parseNdjsonLine,
  prepareSymbolRows,
  reconcileInputAgainstManifest,
  summarizeImport,
  type SeenSymbol,
  type SymbolImportResult,
} from "../../src/lib/ops/backfill-import";

const BATCH_ROWS = 1000;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

/**
 * Pass 1 proves the file is correct; pass 2 writes it. They must be the same
 * bytes, so the file is fingerprinted before pass 1 and re-checked before pass 2.
 */
async function hashFile(path: string): Promise<string> {
  const h = createHash("sha256");
  for await (const c of createReadStream(path)) h.update(c as Buffer);
  return h.digest("hex");
}

async function resolveSymbolIds(symbols: string[]): Promise<Map<string, string>> {
  const rows = await prisma.stockSymbol.findMany({
    where: { symbol: { in: symbols } },
    select: { id: true, symbol: true },
  });
  return new Map(rows.map((r) => [r.symbol, r.id]));
}

/**
 * One statement per batch via unnest. `id` must be supplied because the model's
 * cuid default is applied client-side by Prisma, not by the database; existing
 * rows keep their original id since ON CONFLICT only touches the value columns.
 */
async function upsertBatchIn(
  tx: { $executeRaw: typeof prisma.$executeRaw },
  symbolId: string,
  rows: Array<{ date: Date; bar: { open: number; high: number; low: number; close: number; volume: number } }>,
  source: string
): Promise<number> {
  const ids = rows.map(() => randomUUID());
  const dates = rows.map((r) => isoDay(r.date));
  const opens = rows.map((r) => r.bar.open);
  const highs = rows.map((r) => r.bar.high);
  const lows = rows.map((r) => r.bar.low);
  const closes = rows.map((r) => r.bar.close);
  const volumes = rows.map((r) => r.bar.volume);

  // symbol_id and source are constant across the batch, so they stay scalar
  // parameters; only the per-row columns are unnested.
  return tx.$executeRaw`
    INSERT INTO stock_daily_bars (id, symbol_id, date, open, high, low, close, volume, source, updated_at)
    SELECT t.id, ${symbolId}, t.date, t.open, t.high, t.low, t.close, t.volume, ${source}, now()
    FROM unnest(
      ${ids}::text[],
      ${dates}::date[],
      ${opens}::double precision[],
      ${highs}::double precision[],
      ${lows}::double precision[],
      ${closes}::double precision[],
      ${volumes}::double precision[]
    ) AS t(id, date, open, high, low, close, volume)
    ON CONFLICT (symbol_id, date) DO UPDATE SET
      open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
      close = EXCLUDED.close, volume = EXCLUDED.volume,
      source = EXCLUDED.source, updated_at = now()
  `;
}

async function main(): Promise<void> {
  const inputPath = arg("input");
  const manifestPath = arg("manifest");
  const baselinePath = arg("baseline");
  const outPath = arg("report");
  const dryRun = has("dry-run");
  const source = arg("source") ?? "vnstock:VCI";

  if (!inputPath || !manifestPath || !baselinePath) {
    throw new Error("--input, --manifest and --baseline are all required");
  }

  console.error(`import-backfill-bars → DATABASE_URL: ${describeDatabaseUrl()}`);
  console.error(dryRun ? "MODE: dry-run (no writes)" : "MODE: WRITING");

  // Gate: reconcile before touching anything.
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FetchManifest;
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as BarBaseline;
  // Pilot mode narrows the baseline to a named subset so a staged rollout can be
  // verified before the full universe. It is deliberately explicit and loud: the
  // guard is only as strong as the set it compares against, and a silent subset
  // would defeat the entire point of Gate 1.
  const pilotArg = arg("pilot-symbols");
  const pilotSymbols = pilotArg
    ? pilotArg.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;
  if (pilotSymbols && pilotSymbols.length === 0) {
    // An empty subset would make the baseline zero symbols and the guard
    // vacuously true — the exact bypass this whole gate exists to prevent.
    throw new Error("--pilot-symbols was given but resolved to an empty set — refusing.");
  }
  const effectiveBaseline: BarBaseline = pilotSymbols
    ? { ...baseline, symbols: baseline.symbols.filter((r) => pilotSymbols.includes(r.symbol)) }
    : baseline;
  if (pilotSymbols) {
    console.error(
      `PILOT MODE: baseline narrowed to ${effectiveBaseline.symbols.length} of ` +
        `${baseline.symbols.length} symbols (${pilotSymbols.join(",")}). ` +
        `This does NOT verify the full universe.`
    );
    if (effectiveBaseline.symbols.length !== pilotSymbols.length) {
      throw new Error(
        `--pilot-symbols named ${pilotSymbols.length} symbols but only ` +
          `${effectiveBaseline.symbols.length} are in the baseline — refusing to guess.`
      );
    }
  }

  const rec = reconcileFetchAgainstBaseline(manifest, effectiveBaseline);
  console.log(formatReconciliation(rec));
  if (fetchIsUnsafeToImport(rec)) {
    throw new Error("Fetch does not reconcile against the baseline — refusing to import.");
  }
  if (!isValidIsoDate(manifest.params?.start) || !isValidIsoDate(manifest.params?.end)) {
    throw new Error(
      `Manifest start/end must be real YYYY-MM-DD dates (got ${JSON.stringify(manifest.params?.start)} / ` +
        `${JSON.stringify(manifest.params?.end)}) — refusing to import an unbounded or malformed fetch.`
    );
  }
  if (manifest.params.start >= manifest.params.end) {
    throw new Error(`Manifest start ${manifest.params.start} is not before end ${manifest.params.end}.`);
  }
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (manifest.params.end >= todayUtc) {
    throw new Error(
      `Manifest end ${manifest.params.end} is today or later (${todayUtc}); the last bar may be ` +
        `provisional. Re-fetch with a settled session end.`
    );
  }
  // "Before today" is not the same as "a settled trading session" — a weekend or
  // exchange holiday also satisfies it. The authority is the index itself: the
  // end date must be a session VNINDEX actually traded.
  const endSession = await prisma.indexDailyBar.findFirst({
    where: { symbol: "VNINDEX", date: new Date(`${manifest.params.end}T00:00:00.000Z`) },
    select: { date: true },
  });
  if (!endSession) {
    throw new Error(
      `Manifest end ${manifest.params.end} is not a VNINDEX session in the database — it is a ` +
        `weekend, a holiday, or unimported. Re-fetch ending on a real settled session.`
    );
  }

  // PASS 1 — read the whole input and prove it is the fetch the manifest
  // describes, before a single row is written. A valid manifest paired with a
  // truncated or stale NDJSON would otherwise sail through the baseline check
  // and then write. Memory stays bounded: only counters are retained.
  const seen: SeenSymbol[] = [];
  const reducedWrites: Array<{
    symbol: string;
    raw: number;
    prepared: number;
    invalid: number;
    duplicateDates: number;
  }> = [];
  const malformedLines: string[] = [];
  const inputHashBefore = await hashFile(inputPath);
  {
    const rl1 = createInterface({ input: createReadStream(inputPath, "utf8"), crlfDelay: Infinity });
    let n = 0;
    for await (const line of rl1) {
      n++;
      const parsed = parseNdjsonLine(line, n);
      if (!parsed.ok) {
        // A blank trailing line is normal; anything else means the artifact is
        // malformed and must not be imported on a best-effort basis.
        if (line.trim()) malformedLines.push(parsed.reason);
        continue;
      }
      const prep = prepareSymbolRows(parsed.symbol, parsed.bars);
      // The manifest counted RAW provider rows, so that is what the symbol-set
      // comparison uses. But pass 2 writes PREPARED rows, so any gap between the
      // two means the import would silently write less than the manifest
      // describes — tracked separately and treated as fatal below.
      seen.push({
        symbol: parsed.symbol,
        bars: parsed.bars.length,
        firstDate: prep.rows.length ? isoDay(prep.rows[0]!.date) : null,
        lastDate: prep.rows.length ? isoDay(prep.rows[prep.rows.length - 1]!.date) : null,
      });
      if (prep.skipped.length > 0 || prep.duplicateDates > 0) {
        reducedWrites.push({
          symbol: parsed.symbol,
          raw: parsed.bars.length,
          prepared: prep.rows.length,
          invalid: prep.skipped.length,
          duplicateDates: prep.duplicateDates,
        });
      }
    }
  }

  if (reducedWrites.length > 0) {
    for (const r of reducedWrites) {
      console.error(
        `   ${r.symbol}: manifest/raw ${r.raw} bars but only ${r.prepared} would be written ` +
          `(${r.invalid} invalid, ${r.duplicateDates} duplicate dates)`
      );
    }
    throw new Error(
      `${reducedWrites.length} symbol(s) would write fewer rows than the fetch contains. ` +
        `Refusing: a backfill must write what it verified, not a silently reduced subset. ` +
        `Fix the artifact (re-fetch) rather than importing a partial one.`
    );
  }
  // Reconciliation keys by symbol, so duplicates would collapse there while the
  // writer still processes every line — fatal on both sides of the comparison.
  const dupInput = findDuplicateSymbols(seen.map((s) => s.symbol));
  const dupManifest = findDuplicateSymbols(manifest.perSymbol.map((m) => m.symbol));
  if (dupInput.length > 0 || dupManifest.length > 0) {
    if (dupInput.length) console.error(`   duplicate symbols in input: ${dupInput.join(", ")}`);
    if (dupManifest.length) console.error(`   duplicate symbols in manifest: ${dupManifest.join(", ")}`);
    throw new Error("Duplicate symbols would be written more than once — refusing to import.");
  }

  if (malformedLines.length > 0) {
    for (const m of malformedLines.slice(0, 10)) console.error(`   ${m}`);
    throw new Error(`${malformedLines.length} malformed line(s) in the input — refusing to import.`);
  }

  const inputRec = reconcileInputAgainstManifest(seen, manifest);
  console.log(formatInputReconciliation(inputRec));
  if (!inputMatchesManifest(inputRec)) {
    throw new Error("Input file does not match its manifest — refusing to import.");
  }

  // Resolve every symbol up front. Discovering an unknown symbol mid-write would
  // leave a partial import behind, so the whole set is checked before the first row.
  const allSymbols = seen.map((s) => s.symbol);
  const symbolIds = await resolveSymbolIds(allSymbols);
  const unknownSymbols = allSymbols.filter((s) => !symbolIds.has(s));
  if (unknownSymbols.length > 0) {
    console.error(
      `   not in stock_symbols: ${unknownSymbols.join(", ")}`
    );
    throw new Error(
      `${unknownSymbols.length} fetched symbol(s) are not in stock_symbols. A backfill deepens ` +
        `history for the known universe; adding a listing is a curation decision. Add them first ` +
        `or re-fetch without them — refusing a partial import.`
    );
  }

  // PASS 2 — write. Re-fingerprint first: everything proven above was proven
  // about specific bytes, and only those bytes may be written.
  const inputHashAfter = await hashFile(inputPath);
  if (inputHashAfter !== inputHashBefore) {
    throw new Error(
      `Input file changed between verification and write ` +
        `(${inputHashBefore.slice(0, 12)} → ${inputHashAfter.slice(0, 12)}) — refusing to import.`
    );
  }
  console.error(`input sha256 ${inputHashBefore.slice(0, 16)}… stable across both passes`);

  // Incremental ledger: a killed run still leaves an exact record of which
  // symbols committed, so --resume can finish the job without redoing them.
  const ledgerPath = arg("ledger");
  const completed: string[] = [];
  const resumeDone = new Set<string>();
  if (has("resume") && ledgerPath && existsSync(ledgerPath)) {
    for (const l of readFileSync(ledgerPath, "utf8").split(/\r?\n/)) {
      if (l.trim()) resumeDone.add(l.trim().toUpperCase());
    }
    console.error(`RESUME: ${resumeDone.size} symbol(s) already committed per ${ledgerPath}`);
  }
  const appendLedger = (symbol: string) => {
    if (ledgerPath) appendFileSync(ledgerPath, `${symbol}\n`, "utf8");
  };

  const results: SymbolImportResult[] = [];
  const rl = createInterface({ input: createReadStream(inputPath, "utf8"), crlfDelay: Infinity });
  let lineNo = 0;

  for await (const line of rl) {
    lineNo++;
    const parsed = parseNdjsonLine(line, lineNo);
    if (!parsed.ok) {
      if (line.trim()) console.error(`skip: ${parsed.reason}`);
      continue;
    }
    const prep = prepareSymbolRows(parsed.symbol, parsed.bars);
    if (prep.skipped.length > 0) {
      console.error(`${parsed.symbol}: skipped ${prep.skipped.length} invalid bar(s)`);
    }

    // Guaranteed present: the whole set was resolved before pass 2 began.
    const symbolId = symbolIds.get(parsed.symbol)!;

    let written = 0;
    if (!dryRun) {
      if (resumeDone.has(parsed.symbol)) {
        console.error(`${parsed.symbol}: already completed in the resumed report — skipping`);
        results.push({
          symbol: parsed.symbol,
          barsWritten: 0,
          firstDate: prep.rows.length ? isoDay(prep.rows[0]!.date) : null,
          lastDate: prep.rows.length ? isoDay(prep.rows[prep.rows.length - 1]!.date) : null,
          skipped: prep.skipped.length,
        });
        continue;
      }
      // Atomic per symbol: every batch for one symbol commits together or none
      // does. A single transaction spanning all ~572k rows would hold locks and
      // WAL for the whole run on a serverless Postgres, trading one failure mode
      // for a worse one. The operation is idempotent and purely additive
      // (upsert, never delete), so a run interrupted between symbols leaves a
      // valid, incomplete state that --resume completes and Gate 4 detects.
      await prisma.$transaction(
        async (tx) => {
          for (const batch of chunk(prep.rows, BATCH_ROWS)) {
            written += await upsertBatchIn(tx as never, symbolId, batch, source);
          }
        },
        { timeout: 120_000, maxWait: 20_000 }
      );
      completed.push(parsed.symbol);
      appendLedger(parsed.symbol);
    } else {
      written = prep.rows.length;
    }

    results.push({
      symbol: parsed.symbol,
      barsWritten: written,
      firstDate: prep.rows.length ? isoDay(prep.rows[0]!.date) : null,
      lastDate: prep.rows.length ? isoDay(prep.rows[prep.rows.length - 1]!.date) : null,
      skipped: prep.skipped.length,
    });
    console.error(
      `${parsed.symbol}: ${written} bars ${dryRun ? "(would write)" : "written"} ` +
        `${results[results.length - 1]!.firstDate} → ${results[results.length - 1]!.lastDate}`
    );
  }

  const summary = summarizeImport(results);
  console.log("\n=== import summary ===");
  console.log(JSON.stringify({ dryRun, source, ...summary, symbolsCommitted: completed.length }, null, 2));

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          dryRun,
          source,
          inputSha256: inputHashBefore,
          summary,
          perSymbol: results,
        },
        null,
        2
      ),
      "utf8"
    );
    console.error(`Wrote import report to ${outPath}`);
  }
}

main()
  .catch((e) => {
    console.error("import-backfill-bars FAILED:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
