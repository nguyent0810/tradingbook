/**
 * D2 / D2.1 — RS-adjusted rank ordering evidence (diagnostic only).
 *
 * Usage:
 *   npx tsx scripts/gate2-rs-rank-comparison.ts --replay --json
 *   npx tsx scripts/gate2-rs-rank-comparison.ts --replay --lookbackSessions=60 --json
 *   npx tsx scripts/gate2-rs-rank-comparison.ts --json
 *   npx tsx scripts/gate2-rs-rank-comparison.ts --limit=30 --replay --json
 */
import "./load-env";
import { prisma } from "../src/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "../src/lib/scanner/expected-session";
import { evaluateTradabilityForSymbolId } from "../src/lib/scanner/tradability";
import { evaluateBreakoutPullbackCandidate } from "../src/lib/scanner/gate2/breakout-pullback";
import { resolveTerminalCode } from "../src/lib/scanner/gate2/gate2-threshold-sweep";
import type { Gate2BarInput } from "../src/lib/scanner/gate2/types";
import { buildReplayRowsForSymbol } from "../src/lib/scanner/gate2/gate2-replay-dataset";
import {
  loadRsDiagnosticsForSymbols,
  loadVnindexBarsForRs,
} from "../src/lib/scanner/gate2/load-rs-diagnostics";
import { computeForwardReturnLabels } from "../src/lib/scanner/gate2/forward-returns";
import {
  buildRsRankEvidenceReport,
  formatRsRankEvidenceTable,
  type RsRankReplayAbRow,
} from "../src/lib/scanner/gate2/rs-rank-evidence";
import {
  buildGate2RankWithRsPreview,
  extractRs20SpreadPct,
  extractRs50SpreadPct,
  GATE2_RS_RANK_TERM_CAP,
  GATE2_RS_RANK_TERM_MULTIPLIER,
  isGate2RsRankTermEnabled,
} from "../src/lib/scanner/gate2/rs-rank-term";
import {
  computeRelativeStrengthDiagnostic,
} from "../src/lib/scanner/gate2/relative-strength";
import { parseSetupCandidateReasons } from "../src/lib/scanner/setup-candidate-reasons";
import { describeDatabaseUrl } from "./load-env";

function parseLimit(argv: string[]): number | null {
  const raw = argv.find((a) => a.startsWith("--limit="));
  if (!raw) return null;
  const n = Number.parseInt(raw.slice("--limit=".length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Walk-forward window, in sessions.
 *
 * This was hard-capped at 120, which made the diagnostic structurally unable to
 * answer its own question: 120 sessions yield ~20 A/B candidates and a handful
 * of rank changes, so every forward-outcome bucket came back at n≈1-4. A cap
 * that silently bounds evidence below the level needed for a verdict is worse
 * than no diagnostic, because the output still looks like a result.
 *
 * Uncapped now. The cost is linear in the window and the query is read-only.
 */
function parseLookback(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--lookbackSessions="));
  if (!raw) return 40;
  const n = Number.parseInt(raw.slice("--lookbackSessions=".length), 10);
  return Number.isFinite(n) && n > 0 ? n : 40;
}

function underlying(symbol: string): string {
  const at = symbol.indexOf("@");
  return at >= 0 ? symbol.slice(0, at) : symbol;
}

async function loadAnchorAbRows(
  session: Date,
  indexBars: Gate2BarInput[]
): Promise<{ abRows: RsRankReplayAbRow[]; tradableCount: number }> {
  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  const abRows: RsRankReplayAbRow[] = [];
  let tradableCount = 0;

  for (const s of symbols) {
    const tr = await evaluateTradabilityForSymbolId(prisma, s.id, session);
    if (!tr.passed) continue;
    tradableCount++;

    const dbBars = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
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
    const bars: Gate2BarInput[] = dbBars.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    const ev = evaluateBreakoutPullbackCandidate(bars, session);
    if (ev.quality === "INVALID") continue;

    const rs = computeRelativeStrengthDiagnostic(bars, indexBars, session);
    const preview = buildGate2RankWithRsPreview(
      ev.rankScore,
      extractRs20SpreadPct(rs)
    );

    abRows.push({
      symbol: s.symbol,
      underlying: s.symbol,
      sessionDate: session.toISOString().slice(0, 10),
      quality: ev.quality,
      terminalCode: resolveTerminalCode(ev),
      rankScoreBase: preview.rankScoreBase,
      rs20SpreadPct: preview.rs20SpreadPct,
      rs50SpreadPct: extractRs50SpreadPct(rs),
      rsTerm: preview.rsTerm,
      rankScoreWithRs: preview.rankScoreWithRs,
      forward: computeForwardReturnLabels(bars, session),
    });
  }

  return { abRows, tradableCount };
}

async function loadWalkForwardAbRows(
  session: Date,
  lookbackSessions: number,
  limit: number | null
): Promise<{ abRows: RsRankReplayAbRow[]; tradableCount: number; evaluationRowCount: number }> {
  const indexBars = await loadVnindexBarsForRs(prisma);
  const symbols = await prisma.stockSymbol.findMany({
    where: { active: true },
    select: { id: true, symbol: true },
    orderBy: { symbol: "asc" },
  });

  const abRows: RsRankReplayAbRow[] = [];
  let tradableCount = 0;
  let evaluationRowCount = 0;

  for (const s of symbols) {
    const tr = await evaluateTradabilityForSymbolId(prisma, s.id, session);
    if (!tr.passed) continue;

    const dbBars = await prisma.stockDailyBar.findMany({
      where: { symbolId: s.id },
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
    const allBars: Gate2BarInput[] = dbBars.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    const replayRows = buildReplayRowsForSymbol({
      symbol: s.symbol,
      allBars,
      lookbackSessions,
      asOf: null,
    });
    if (replayRows.length === 0) continue;

    tradableCount++;
    evaluationRowCount += replayRows.length;

    for (const row of replayRows) {
      const ev = evaluateBreakoutPullbackCandidate(row.bars, row.sessionDate);
      if (ev.quality === "INVALID") continue;

      const rs = computeRelativeStrengthDiagnostic(
        [...row.bars],
        indexBars,
        row.sessionDate
      );
      const preview = buildGate2RankWithRsPreview(
        ev.rankScore,
        extractRs20SpreadPct(rs)
      );

      abRows.push({
        symbol: row.symbol,
        underlying: underlying(row.symbol),
        sessionDate: row.sessionDate.toISOString().slice(0, 10),
        quality: ev.quality,
        terminalCode: resolveTerminalCode(ev),
        rankScoreBase: preview.rankScoreBase,
        rs20SpreadPct: preview.rs20SpreadPct,
        rs50SpreadPct: extractRs50SpreadPct(rs),
        rsTerm: preview.rsTerm,
        rankScoreWithRs: preview.rankScoreWithRs,
        forward: computeForwardReturnLabels(row.fullBars, row.sessionDate),
      });
    }

    if (limit != null && tradableCount >= limit) break;
  }

  return { abRows, tradableCount, evaluationRowCount };
}

async function loadFromLatestScan(
  session: Date,
  indexBars: Gate2BarInput[]
): Promise<RsRankReplayAbRow[]> {
  const run = await prisma.dailyScanRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { runAt: "desc" },
    select: { id: true },
  });
  if (!run) return [];

  const rows = await prisma.setupCandidate.findMany({
    where: { scanRunId: run.id },
    include: { symbol: { select: { symbol: true } } },
    orderBy: { rankScore: "desc" },
  });

  const rsMap = await loadRsDiagnosticsForSymbols(
    prisma,
    rows.map((r) => r.symbol.symbol),
    session,
    indexBars
  );

  return rows.map((r) => {
    const sym = r.symbol.symbol;
    const parsed = parseSetupCandidateReasons(r.reasons);
    const base = parsed.rankComponents?.rankScore ?? r.rankScore;
    const rs = rsMap.get(sym) ?? null;
    const preview = buildGate2RankWithRsPreview(base, extractRs20SpreadPct(rs));
    return {
      symbol: sym,
      underlying: sym,
      sessionDate: session.toISOString().slice(0, 10),
      quality: r.quality as "A" | "B",
      terminalCode: "VALID",
      rankScoreBase: preview.rankScoreBase,
      rs20SpreadPct: preview.rs20SpreadPct,
      rs50SpreadPct: extractRs50SpreadPct(rs),
      rsTerm: preview.rsTerm,
      rankScoreWithRs: preview.rankScoreWithRs,
      forward: null,
    };
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const jsonOut = argv.includes("--json");
  const useReplay = argv.includes("--replay");
  const limit = parseLimit(argv);
  const lookbackSessions = parseLookback(argv);

  console.error("gate2-rs-rank-comparison.ts → DATABASE_URL:", describeDatabaseUrl());
  console.error("GATE2_RS_RANK_TERM_ENABLED:", isGate2RsRankTermEnabled());

  const session = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!session) {
    console.error(JSON.stringify({ error: "No VNINDEX session." }, null, 2));
    process.exit(1);
  }

  const indexBars = await loadVnindexBarsForRs(prisma);
  const formula = `rsTerm = clamp(RS20_pp × ${GATE2_RS_RANK_TERM_MULTIPLIER}, -${GATE2_RS_RANK_TERM_CAP}, +${GATE2_RS_RANK_TERM_CAP})`;

  let report;
  let tradableCount = 0;
  let evaluationRowCount = 0;

  if (useReplay) {
    const wf = await loadWalkForwardAbRows(session, lookbackSessions, limit);
    tradableCount = wf.tradableCount;
    evaluationRowCount = wf.evaluationRowCount;
    report = buildRsRankEvidenceReport({
      anchorSession: session.toISOString().slice(0, 10),
      lookbackSessions,
      mode: "walkforward_ab",
      formula,
      productionRsRankEnabled: isGate2RsRankTermEnabled(),
      abRows: wf.abRows,
      evaluationRowCount,
      rsComputedPerSession: true,
    });
  } else if (argv.includes("--scan-only")) {
    const abRows = await loadFromLatestScan(session, indexBars);
    report = buildRsRankEvidenceReport({
      anchorSession: session.toISOString().slice(0, 10),
      lookbackSessions: 1,
      mode: "anchor_ab",
      formula,
      productionRsRankEnabled: isGate2RsRankTermEnabled(),
      abRows,
      evaluationRowCount: abRows.length,
      rsComputedPerSession: true,
    });
  } else {
    const anchor = await loadAnchorAbRows(session, indexBars);
    tradableCount = anchor.tradableCount;
    evaluationRowCount = anchor.abRows.length;
    report = buildRsRankEvidenceReport({
      anchorSession: session.toISOString().slice(0, 10),
      lookbackSessions: 1,
      mode: "anchor_ab",
      formula,
      productionRsRankEnabled: isGate2RsRankTermEnabled(),
      abRows: anchor.abRows,
      evaluationRowCount,
      rsComputedPerSession: true,
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    tradableCount,
    ...report,
  };

  if (jsonOut) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(formatRsRankEvidenceTable(report));
    console.log("");
    console.log(`Tradable: ${tradableCount} · eval rows: ${evaluationRowCount}`);
    console.log(report.enablementRecommendation);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
