/**
 * Prospective outcome appender — fills in outcomes for decisions already recorded.
 *
 * It reads the decisions file and writes ONLY the outcomes file. It has no code
 * path that opens the decisions file for writing, which is what makes decision-row
 * immutability structural rather than promised (plan §4).
 *
 * Every bar it loads is dated strictly after the decision session, so it cannot
 * see, let alone alter, a decision-time input.
 *
 *   npx tsx scripts/replay/append-prospective-outcomes.ts
 */
import "../load-env";
import { prisma } from "../../src/lib/prisma";
import { describeDatabaseUrl } from "../load-env";
import { isoDay } from "../../src/lib/replay/point-in-time-guard";
import { computeOutcome, type FutureBar } from "../../src/lib/prospective/outcomes";
import { appendOutcome, readDecisions, readOutcomes } from "../../src/lib/prospective/registry-store";
import { OUTCOME_HORIZON_SESSIONS } from "../../src/lib/prospective/registry-schema";

function arg(n: string): string | undefined {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (h) return h.slice(n.length + 3);
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
async function wr<T>(fn: () => Promise<T>, t = 8): Promise<T> {
  let e: unknown;
  for (let i = 0; i < t; i++) {
    try { return await fn(); } catch (x) { e = x; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  throw e;
}

async function main(): Promise<void> {
  const dir = arg("dir") ?? "docs/trading/replay/prospective";
  console.error(`outcome appender → ${describeDatabaseUrl()} (read-only on the database)`);

  const decisions = readDecisions(dir);
  const done = new Set(readOutcomes(dir).map((o) => o.setupId));
  const pending = decisions.filter((d) => !done.has(d.setupId));
  console.error(`decisions ${decisions.length} · outcomes ${done.size} · pending ${pending.length}`);
  if (!pending.length) { await prisma.$disconnect(); return; }

  const symbolIds = new Map<string, string>();
  for (const s of await wr(() => prisma.stockSymbol.findMany({ select: { id: true, symbol: true } }))) {
    symbolIds.set(s.symbol, s.id);
  }

  let written = 0, notReady = 0, refused = 0, missing = 0, badBars = 0;

  for (const d of pending) {
    const id = symbolIds.get(d.symbol);
    if (!id) { missing++; continue; }

    // Strictly after the decision session. `new Date("2026-09-01")` is midnight
    // UTC, so a same-session bar stored at 07:00Z would pass a naive `gt` filter;
    // the end-of-day bound closes that, and `computeOutcome` refuses any bar that
    // still slips through rather than trusting this query.
    const rows = await wr(() => prisma.stockDailyBar.findMany({
      where: { symbolId: id, date: { gt: new Date(`${d.session}T23:59:59.999Z`) } },
      orderBy: { date: "asc" },
      take: OUTCOME_HORIZON_SESSIONS,
      select: { date: true, open: true, high: true, low: true, close: true },
    }));
    const futureBars: FutureBar[] = rows.map((b) => ({
      date: isoDay(b.date), open: b.open, high: b.high, low: b.low, close: b.close,
    }));

    const c = computeOutcome({ setupId: d.setupId, session: d.session, riskFrac: d.riskFrac, futureBars });
    if (!c.ready) {
      if (c.reason === "BAR_AT_OR_BEFORE_DECISION") {
        badBars++;
        console.error(`  ${d.symbol} ${d.session}: refused, ${c.have} bar(s) at or before the decision`);
      } else notReady++;
      continue;
    }

    const res = appendOutcome({ ...c.entry, outcomeRecordedAt: new Date().toISOString() }, dir);
    if (res.ok) written++;
    else { refused++; console.error(`  ${d.symbol} ${d.session} refused: ${res.refusal}`); }
  }

  console.log(
    `\nwritten ${written} · not settled yet ${notReady} · refused ${refused} · ` +
    `unknown symbol ${missing} · bars at or before the decision ${badBars}`,
  );
  console.log(`registry: ${dir}/outcomes.ndjson`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
