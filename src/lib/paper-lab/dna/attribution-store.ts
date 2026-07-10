/**
 * Performance Attribution persistence + monthly aggregation.
 *
 * `finalizeTradeAttributions` computes a TradeAttribution per closed trade
 * (upsert, idempotent), re-finalizing recent trades whose post-exit window has
 * since completed to fill `leftOnTablePct` (no lookahead — post-exit bars are
 * only read once available). `aggregateMonthlyAttribution` rolls trade rows up
 * per manager per month (upsert), including a deterministic cash-drag estimate.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { getManagerDna } from "@/lib/paper-lab/dna/manager-configs";
import {
  ATTRIBUTION_SCHEMA_VERSION,
  computeCashDragVnd,
  computeTradeAttribution,
  POST_EXIT_WINDOW,
  type AttributionEntryDecisionInput,
} from "@/lib/paper-lab/dna/attribution";

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export async function finalizeTradeAttributions(prisma: PrismaClient, sessionDate: Date): Promise<number> {
  const lookbackStart = new Date(sessionDate.getTime() - 30 * 86_400_000);
  const trades = await prisma.paperTrade.findMany({
    where: {
      closedSessionDate: { gte: lookbackStart, lte: sessionDate },
      OR: [{ attribution: { is: null } }, { attribution: { is: { leftOnTablePct: null } } }],
    },
    include: { position: { include: { portfolio: { include: { agent: true } } } } },
  });

  let count = 0;
  for (const trade of trades) {
    const position = trade.position;
    const agent = position.portfolio.agent;
    const dna = getManagerDna(agent.slug);

    let ed: AttributionEntryDecisionInput | undefined;
    if (position.entryDecisionId) {
      const dec = await prisma.agentDecision.findUnique({ where: { id: position.entryDecisionId }, include: { output: true, input: true } });
      const out = dec?.output?.payload as Record<string, unknown> | undefined;
      const inp = dec?.input?.payload as Record<string, unknown> | undefined;
      const meta = (out?.metadata ?? {}) as Record<string, unknown>;
      const gate2 = (inp?.gate2Setup ?? null) as { quality?: "A" | "B" | null } | null;
      const regime = ((inp?.marketRegime as Record<string, unknown>)?.regimeDimensions ?? {}) as { trendRegime?: string };
      ed = {
        id: dec?.id ?? null,
        confidence: typeof out?.confidence === "number" ? out.confidence : undefined,
        reasonCodes: Array.isArray(out?.reason_codes) ? (out.reason_codes as string[]) : [],
        setupQuality: gate2?.quality ?? null,
        regimeAtEntry: regime.trendRegime ?? null,
        riskMult: (meta.memoryModulation as { riskMult?: number } | undefined)?.riskMult ?? 1,
        dnaVersion: (meta.dnaVersion as string | undefined) ?? null,
      };
    }

    const exitRegimeRow = await prisma.marketRegimeSnapshot.findUnique({ where: { sessionDate: trade.closedSessionDate } });
    const regimeAtExit = (exitRegimeRow?.dimensionsJson as { trendRegime?: string } | null)?.trendRegime ?? null;
    const entryBar = await prisma.stockDailyBar.findFirst({ where: { symbol: { symbol: position.symbol }, date: position.openedAt } });
    const postBars = await prisma.stockDailyBar.findMany({ where: { symbol: { symbol: position.symbol }, date: { gt: trade.closedSessionDate } }, orderBy: { date: "asc" }, take: POST_EXIT_WINDOW });

    const r = computeTradeAttribution({
      trade: { id: trade.id, entryKvnd: trade.entryKvnd, exitKvnd: trade.exitKvnd, quantity: trade.quantity, realizedPnlVnd: Number(trade.realizedPnlVnd), rMultiple: trade.rMultiple, holdingDays: trade.holdingDays, exitReason: trade.exitReason },
      position: { id: position.id, avgEntryKvnd: position.avgEntryKvnd, stopLossKvnd: position.stopLossKvnd, initialRiskPerShareKvnd: position.initialRiskPerShareKvnd, maxFavorableExcursionKvnd: position.maxFavorableExcursionKvnd, maxAdverseExcursionKvnd: position.maxAdverseExcursionKvnd, highWaterMarkKvnd: position.highWaterMarkKvnd },
      agentId: position.portfolio.agentId,
      dna,
      entryDecision: ed,
      regimeAtExit,
      entrySessionRange: entryBar ? { low: entryBar.low, high: entryBar.high } : null,
      postExitBars: postBars.map((b) => ({ high: b.high, low: b.low, close: b.close })),
    });

    const data = {
      positionId: position.id,
      agentId: position.portfolio.agentId,
      entryDecisionId: position.entryDecisionId ?? null,
      exitDecisionId: null as string | null,
      attributionSchemaVersion: r.attributionSchemaVersion,
      engineVersion: r.engineVersion,
      dnaVersion: r.dnaVersion,
      setupType: r.setupType,
      exitReason: r.exitReason,
      regimeAtEntry: r.regimeAtEntry,
      regimeAtExit: r.regimeAtExit,
      mfeR: r.mfeR,
      maeR: r.maeR,
      entryQualityScore: r.entryQualityScore,
      holdingQualityScore: r.holdingQualityScore,
      exitQualityScore: r.exitQualityScore,
      sizingQualityScore: r.sizingQualityScore,
      regimeFitScore: r.regimeFitScore,
      riskControlScore: r.riskControlScore,
      grossPriceMoveVnd: BigInt(r.grossPriceMoveVnd),
      feesVnd: BigInt(r.feesVnd),
      realizedPnlVnd: BigInt(r.realizedPnlVnd),
      leftOnTablePct: r.leftOnTablePct,
      reasonCodesJson: r.reasonCodes as object,
      contributionsJson: r.contributions as object,
      inputHash: r.inputHash,
    };
    await prisma.tradeAttribution.upsert({ where: { paperTradeId: trade.id }, create: { paperTradeId: trade.id, ...data }, update: data });
    count += 1;
  }
  return count;
}

export async function aggregateMonthlyAttribution(prisma: PrismaClient, sessionDate: Date): Promise<number> {
  const month = monthKey(sessionDate);
  const start = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth() + 1, 0));

  const attributions = await prisma.tradeAttribution.findMany({ where: { paperTrade: { closedSessionDate: { gte: start, lte: end } } } });
  const byAgent = new Map<string, typeof attributions>();
  for (const a of attributions) { const arr = byAgent.get(a.agentId) ?? []; arr.push(a); byAgent.set(a.agentId, arr); }

  // Benchmark return over the month (VNINDEX first→last close).
  const idxBars = await prisma.indexDailyBar.findMany({ where: { symbol: "VNINDEX", date: { gte: start, lte: end } }, orderBy: { date: "asc" } });
  const benchReturnPct = idxBars.length >= 2 ? ((idxBars[idxBars.length - 1]!.close / idxBars[0]!.close) - 1) * 100 : 0;

  let count = 0;
  for (const [agentId, rows] of byAgent) {
    const n = rows.length;
    const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / n;
    const realized = rows.reduce((s, r) => s + Number(r.realizedPnlVnd), 0);

    const bySetup: Record<string, { n: number; realizedPnlVnd: number }> = {};
    const byRegime: Record<string, { n: number; realizedPnlVnd: number; wins: number }> = {};
    for (const r of rows) {
      const s = (bySetup[r.setupType] ??= { n: 0, realizedPnlVnd: 0 }); s.n += 1; s.realizedPnlVnd += Number(r.realizedPnlVnd);
      const key = r.regimeAtEntry ?? "Unknown";
      const g = (byRegime[key] ??= { n: 0, realizedPnlVnd: 0, wins: 0 }); g.n += 1; g.realizedPnlVnd += Number(r.realizedPnlVnd); if (Number(r.realizedPnlVnd) > 0) g.wins += 1;
    }

    // Cash drag from portfolio snapshots this month.
    const snaps = await prisma.portfolioSnapshot.findMany({ where: { portfolio: { agentId }, sessionDate: { gte: start, lte: end } }, orderBy: { sessionDate: "asc" } });
    let cashDragVnd = BigInt(0);
    if (snaps.length > 0) {
      const avgCashPct = snaps.reduce((s, x) => s + (Number(x.navVnd) > 0 ? Number(x.cashVnd) / Number(x.navVnd) : 0), 0) / snaps.length;
      const navVnd = Number(snaps[snaps.length - 1]!.navVnd);
      cashDragVnd = BigInt(computeCashDragVnd(avgCashPct, benchReturnPct, navVnd));
    }

    const data = {
      attributionSchemaVersion: ATTRIBUTION_SCHEMA_VERSION,
      tradeCount: n,
      realizedPnlVnd: BigInt(Math.round(realized)),
      reconciledPnlVnd: BigInt(Math.round(realized)),
      avgEntryQuality: avg((r) => r.entryQualityScore),
      avgHoldingQuality: avg((r) => r.holdingQualityScore),
      avgExitQuality: avg((r) => r.exitQualityScore),
      avgSizingQuality: avg((r) => r.sizingQualityScore),
      avgRegimeFit: avg((r) => r.regimeFitScore),
      avgRiskControl: avg((r) => r.riskControlScore),
      cashDragVnd,
      bySetupJson: bySetup as object,
      byRegimeJson: byRegime as object,
    };
    await prisma.managerAttributionMonthly.upsert({ where: { agentId_month: { agentId, month } }, create: { agentId, month, ...data }, update: data });
    count += 1;
  }
  return count;
}
