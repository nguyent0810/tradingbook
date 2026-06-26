import type { PrismaClient } from "@/generated/prisma/client";
import { PAPER_CONTEXT_SCHEMA_VERSION, PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import {
  PAPER_BASE_RISK_PER_TRADE_PCT,
  PAPER_MAX_PER_TRADE_EXPOSURE_PCT,
  PAPER_MAX_PORTFOLIO_EXPOSURE_PCT,
} from "@/lib/paper-lab/constants";
import type { MarketContextBundle } from "@/lib/paper-lab/types/market-context-bundle";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import { computeRelativeStrengthDiagnostic } from "@/lib/scanner/gate2/relative-strength";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { evaluateTradabilityForSymbolId } from "@/lib/scanner/tradability";
import { computeDailyTradingDecision } from "@/lib/scanner/trading-decision";
import { computePortfolioState } from "@/lib/paper-lab/portfolio/portfolio-service";
import { classifyRegimeForSession } from "@/lib/lab/regime/classify-regime";
import { computeSetupSignature, loadAgentMemoryRecall } from "@/lib/lab/memory/build-memory";
import type { RegimeDimensions } from "@/lib/lab/types/regime";

function toGate2Bars(
  rows: { date: Date; open: number; high: number; low: number; close: number; volume: number }[]
): Gate2BarInput[] {
  return rows.map((r) => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

export async function buildMarketContextBundle(
  prisma: PrismaClient,
  params: {
    symbol: string;
    sessionDate: Date;
    agentId: string;
    marks?: Map<string, number>;
  }
): Promise<MarketContextBundle | null> {
  const stock = await prisma.stockSymbol.findUnique({
    where: { symbol: params.symbol },
    include: {
      bars: {
        where: { date: { lte: params.sessionDate } },
        orderBy: { date: "asc" },
        take: 200,
      },
    },
  });

  if (!stock || stock.bars.length === 0) return null;

  const indexBars = await prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX", date: { lte: params.sessionDate } },
    orderBy: { date: "asc" },
    take: 200,
  });

  const indexGate2 = indexBars.map((b) => ({
    date: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  const stockBars = toGate2Bars(stock.bars);
  const evalBar = stock.bars[stock.bars.length - 1]!;
  const prevBar = stock.bars.length > 1 ? stock.bars[stock.bars.length - 2]! : null;

  const gate2 = evaluateBreakoutPullbackCandidate(stockBars, params.sessionDate);
  const rs = computeRelativeStrengthDiagnostic(stockBars, indexGate2, params.sessionDate);
  const tradability = await evaluateTradabilityForSymbolId(prisma, stock.id, params.sessionDate);

  const ctxDaily = await prisma.marketContextDaily.findUnique({
    where: { sessionDate: params.sessionDate },
  });

  const symCtx = await prisma.symbolMarketContextDaily.findUnique({
    where: {
      sessionDate_symbolId: { sessionDate: params.sessionDate, symbolId: stock.id },
    },
  });

  const portfolio = await prisma.paperPortfolio.findUnique({
    where: { agentId: params.agentId },
    include: {
      positions: {
        where: { symbol: params.symbol, status: { in: ["OPEN", "PARTIAL"] } },
      },
    },
  });

  const marks = params.marks ?? new Map<string, number>();
  marks.set(params.symbol, evalBar.close);

  const portfolioState = portfolio
    ? await computePortfolioState(prisma, portfolio.id, marks)
    : {
        agentId: params.agentId,
        cashVnd: PAPER_INITIAL_CAPITAL_VND,
        navVnd: PAPER_INITIAL_CAPITAL_VND,
        exposurePct: 0,
        openPositionCount: 0,
        sectorExposure: {},
      };

  const gate1 = ctxDaily?.gate1Level ?? "WARNING";
  const scanRun = await prisma.dailyScanRun.findFirst({
    where: { runAt: { lte: new Date(params.sessionDate.getTime() + 86400000) } },
    orderBy: { runAt: "desc" },
  });

  const dailyDecision = computeDailyTradingDecision({
    gate1Level: gate1,
    candidateCountA: scanRun?.candidateCountA ?? 0,
    candidateCountB: scanRun?.candidateCountB ?? 0,
  });

  const openPos = portfolio?.positions[0];

  const regimeRow = await prisma.marketRegimeSnapshot.findUnique({
    where: { sessionDate: params.sessionDate },
  });
  const regimeSnapshot =
    regimeRow != null
      ? {
          dimensions: regimeRow.dimensionsJson as RegimeDimensions,
          labels: [
            (regimeRow.dimensionsJson as RegimeDimensions).trendRegime,
            (regimeRow.dimensionsJson as RegimeDimensions).volatilityRegime,
            (regimeRow.dimensionsJson as RegimeDimensions).breadthRegime,
            regimeRow.gate1Level ?? "UNKNOWN",
          ],
          confidence: regimeRow.confidence,
        }
      : null;

  const setupSignature = computeSetupSignature({
    gate2Quality: gate2?.quality ?? null,
    rsBucket:
      rs?.returns[0] != null
        ? rs.returns[0].rsSpreadPct > 2
          ? "strong"
          : rs.returns[0].rsSpreadPct < -2
            ? "weak"
            : "neutral"
        : "neutral",
    regimeTag: regimeSnapshot?.dimensions.trendRegime,
    sector: null,
  });
  const agentMemoryRecall = await loadAgentMemoryRecall(
    prisma,
    params.agentId,
    setupSignature
  );

  const regimeReasons: string[] = [];
  if (regimeSnapshot) {
    regimeReasons.push(
      `${regimeSnapshot.dimensions.trendRegime} trend`,
      `${regimeSnapshot.dimensions.breadthRegime} breadth`,
      `${regimeSnapshot.dimensions.volatilityRegime} vol`
    );
  }

  return {
    schemaVersion: PAPER_CONTEXT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sessionDate: params.sessionDate.toISOString().slice(0, 10),
    symbol: params.symbol,
    symbolMeta: {
      exchange: stock.exchange,
      name: stock.name,
      sector: null,
      tradability,
    },
    price: {
      closeKVnd: evalBar.close,
      openKVnd: evalBar.open,
      highKVnd: evalBar.high,
      lowKVnd: evalBar.low,
      prevCloseKVnd: prevBar?.close ?? null,
      changePct: prevBar ? ((evalBar.close / prevBar.close - 1) * 100) : null,
      barsAvailable: stock.bars.length,
    },
    volume: {
      volume: evalBar.volume,
      volMa20: symCtx?.volMa20 ?? null,
      volRatioMa20: symCtx?.volRatioMa20 ?? null,
      avgValueVnd20: symCtx?.close && symCtx?.volMa20 ? symCtx.close * 1000 * symCtx.volMa20 : null,
    },
    technicals: {
      ma20: null,
      ma50: null,
      atr14KVnd: null,
      range20dHigh: gate2?.breakoutLevel ?? null,
      range20dLow: gate2?.pullbackZoneLow ?? null,
    },
    relativeStrength: rs,
    earlyEntry: null,
    gate2Setup: gate2,
    marketRegime: {
      gate1Level: gate1,
      reasons: regimeReasons,
      vnindexClose: ctxDaily?.vnindexClose ?? null,
      foreignNetValue1d: ctxDaily?.foreignNetValue1d ?? null,
      regimeDimensions: regimeSnapshot?.dimensions,
      regimeLabels: regimeSnapshot?.labels,
      regimeConfidence: regimeSnapshot?.confidence,
    },
    agentMemoryRecall,
    fundamentals: null,
    newsSentiment: null,
    liquidity: {
      tradable: tradability.passed,
      minAvgValueVnd20: 2_000_000_000,
      actualAvgValueVnd20: symCtx?.close && symCtx?.volMa20 ? symCtx.close * 1000 * symCtx.volMa20 : null,
      priceFloorVnd: 10_000,
    },
    riskContext: {
      dailyTradingDecision: dailyDecision,
      maxPortfolioExposurePct: PAPER_MAX_PORTFOLIO_EXPOSURE_PCT,
      maxPerTradeExposurePct: PAPER_MAX_PER_TRADE_EXPOSURE_PCT,
      baseRiskPerTradePct: PAPER_BASE_RISK_PER_TRADE_PCT,
    },
    existingPosition: openPos
      ? {
          positionId: openPos.id,
          quantity: openPos.quantity,
          entryPriceKVnd: openPos.avgEntryKvnd,
          stopLossKVnd: openPos.stopLossKvnd,
          takeProfitKVnd: openPos.takeProfitKvnd,
          unrealizedPnlVnd: Math.round((evalBar.close - openPos.avgEntryKvnd) * 1000 * openPos.quantity),
          holdingDays: 0,
          status: openPos.status === "PARTIAL" ? "PARTIAL" : "OPEN",
        }
      : null,
    portfolioState: {
      agentId: params.agentId,
      cashVnd: portfolioState.cashVnd ?? PAPER_INITIAL_CAPITAL_VND,
      navVnd: portfolioState.navVnd ?? PAPER_INITIAL_CAPITAL_VND,
      exposurePct: portfolioState.exposurePct ?? 0,
      openPositionCount: portfolioState.openPositionCount ?? 0,
      sectorExposure: portfolioState.sectorExposure ?? {},
    },
  };
}

export async function buildContextBundlesForUniverse(
  prisma: PrismaClient,
  sessionDate: Date,
  agentId: string,
  symbols: string[]
): Promise<MarketContextBundle[]> {
  const marks = new Map<string, number>();
  const bundles: MarketContextBundle[] = [];
  for (const symbol of symbols) {
    const b = await buildMarketContextBundle(prisma, { symbol, sessionDate, agentId, marks });
    if (b) bundles.push(b);
  }
  return bundles;
}

export async function resolvePaperLabSymbolUniverse(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<string[]> {
  const scan = await prisma.dailyScanRun.findFirst({
    orderBy: { runAt: "desc" },
    include: { candidates: { take: 30, include: { symbol: true } } },
  });

  const fromScan = scan?.candidates.map((c) => c.symbol.symbol) ?? [];
  const openPositions = await prisma.paperPosition.findMany({
    where: { status: { in: ["OPEN", "PARTIAL"] } },
    select: { symbol: true },
  });

  const set = new Set<string>([...fromScan, ...openPositions.map((p) => p.symbol)]);
  return [...set].slice(0, 40);
}
