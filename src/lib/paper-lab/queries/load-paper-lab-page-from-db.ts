import { prisma } from "@/lib/prisma";
import { loadArenaBattles } from "@/lib/paper-lab/queries/load-arena-battles";
import { PAPER_AGENT_SEEDS, PAPER_INITIAL_CAPITAL_VND } from "@/lib/paper-lab/constants";
import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import type {
  AgentDecisionOutput,
  CioRecommendation,
} from "@/lib/paper-lab/types/agent-decision.schema";
import type { AgentAction } from "@/lib/paper-lab/types/agent-decision.schema";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";
import type { RegimeDimensions } from "@/lib/lab/types/regime";
import { getPaperLabExecutionMode } from "@/lib/paper-lab/llm-config";
import type { Gate1Level } from "@/lib/scanner/gate2/types";
import {
  computeDailyTradingDecision,
  parsePersistedDailyDecision,
} from "@/lib/scanner/trading-decision";
import { buildLatestCloseBySymbol } from "@/lib/dashboard/latest-close-by-symbol";
import type { PortfolioSnapshot } from "@/generated/prisma/client";
import {
  buildBattleInsight,
  buildCioPresentation,
  buildDecisionExplanation,
  formatRegimeDimension,
} from "@/lib/paper-lab/ui/arena-copy";

/** Calendar-day lookback for the 14-point NAV sparkline (margin above 14 daily snapshots for weekend/holiday gaps). */
const PORTFOLIO_SPARKLINE_LOOKBACK_CALENDAR_DAYS = 60;

function tableExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("paper_agents") || msg.includes("does not exist");
}

function agentDisplayName(slug: string): string {
  return PAPER_AGENT_SEEDS.find((a) => a.slug === slug)?.displayName ?? slug;
}

function utcDayDiff(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const b = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.floor((a - b) / 86_400_000);
}

function parsePayload(raw: unknown): Partial<AgentDecisionOutput> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as Partial<AgentDecisionOutput>;
}

function formatRegimeContext(
  raw: unknown,
  fallbackLabels: string[]
): string {
  if (typeof raw === "string" && raw.trim()) return raw;
  if (raw && typeof raw === "object") {
    const dims = raw as Partial<RegimeDimensions>;
    const parts = [dims.trendRegime, dims.volatilityRegime, dims.breadthRegime].filter(Boolean);
    if (parts.length > 0) return parts.join(" · ");
  }
  if (fallbackLabels.length > 0) return fallbackLabels.join(" · ");
  return "Unknown";
}

function buildMarketPulse(
  regimeCtx: { vnindexClose: number | null; vnindexMa20: number | null } | null,
  dimensions: RegimeDimensions | undefined
) {
  const close = regimeCtx?.vnindexClose ?? null;
  const ma20 = regimeCtx?.vnindexMa20 ?? null;
  const changePct =
    close != null && ma20 != null && ma20 > 0 ? ((close - ma20) / ma20) * 100 : null;

  return {
    vnindexClose: close,
    vnindexChangePct: changePct,
    liquidityLabel: dimensions?.liquidityRegime
      ? formatRegimeDimension(dimensions.liquidityRegime)
      : "—",
    volatilityLabel: dimensions?.volatilityRegime
      ? formatRegimeDimension(dimensions.volatilityRegime)
      : "—",
    breadthLabel: dimensions?.breadthRegime
      ? formatRegimeDimension(dimensions.breadthRegime)
      : "—",
  };
}

function countBattleVotes(decisions: Array<{ action: string }>) {
  let buy = 0;
  let hold = 0;
  let sell = 0;
  let reduce = 0;
  for (const d of decisions) {
    if (d.action === "BUY" || d.action === "ADD") buy++;
    else if (d.action === "HOLD") hold++;
    else if (d.action === "SELL" || d.action === "EXIT") sell++;
    else if (d.action === "REDUCE") reduce++;
  }
  return { buy, hold, sell, reduce };
}

/**
 * Kết quả nạp có phân biệt ba trạng thái.
 *
 * `loadPaperLabPageFromDb()` gộp "chưa có tác tử nào" và "bảng chưa được migrate"
 * thành cùng một `null`, nhưng hai thứ đó khác hẳn nhau: một cái là dữ liệu rỗng
 * hợp lệ, một cái là sự cố hạ tầng cần hiện bằng chứng chứ không được im lặng
 * trở thành ô rỗng.
 */
export type PaperLabDbLoad =
  | { kind: "ok"; dto: PaperLabPageDto }
  | { kind: "empty" }
  | { kind: "error"; error: string };

export async function loadPaperLabPageDbLoad(): Promise<PaperLabDbLoad> {
  try {
    const dto = await queryPaperLabPage();
    return dto ? { kind: "ok", dto } : { kind: "empty" };
  } catch (err) {
    if (tableExistsError(err)) {
      return {
        kind: "error",
        error: `Bảng Đấu trường chưa tồn tại trong cơ sở dữ liệu — chạy migration. Chi tiết: ${String(err)}`,
      };
    }
    return { kind: "error", error: `loadPaperLabPageFromDb() → ${String(err)}` };
  }
}

/**
 * Bản tương thích ngược cho các route API: `null` cho cả rỗng lẫn thiếu bảng.
 * Màn F3 dùng `loadPaperLabPageDbLoad()` để phân biệt được hai trạng thái đó.
 */
export async function loadPaperLabPageFromDb(): Promise<PaperLabPageDto | null> {
  const result = await loadPaperLabPageDbLoad();
  if (result.kind === "ok") return result.dto;
  if (result.kind === "empty") return null;
  if (result.error.startsWith("Bảng Đấu trường chưa tồn tại")) return null;
  throw new Error(result.error);
}

async function queryPaperLabPage(): Promise<PaperLabPageDto | null> {
  // Khối lồng giữ nguyên thụt lề của thân hàm cũ (trước đây là `try`), để diff
  // của lần tách này chỉ gồm phần xử lý lỗi chứ không phải 460 dòng đổi thụt lề.
  {
    const [agentCount, latestPerf] = await Promise.all([
      prisma.paperAgent.count(),
      prisma.agentPerformanceDaily.findFirst({ orderBy: { sessionDate: "desc" } }),
    ]);
    if (agentCount === 0) return null;

    // Chưa có hàng hiệu suất nào ⇒ không có phiên nào để đo. Vẫn cần MỘT mốc để
    // truy vấn xếp hạng/vị thế, nhưng phải nhớ rằng mốc đó là do ta tự đặt chứ
    // không phải phiên có thật — `performanceSessionDate` bên dưới nói ra điều đó.
    const perfSessionDate = latestPerf?.sessionDate ?? null;
    const sessionDate = perfSessionDate ?? new Date();

    const [
      agents,
      rankings,
      openPositions,
      decisions,
      cioRows,
      regimeSnapshot,
      regimeCtx,
      battle,
      allBattles,
      latestScanRun,
    ] = await Promise.all([
      prisma.paperAgent.findMany({
        where: { slug: { not: "cio" } },
        include: {
          portfolio: true,
          performance: {
            where: { sessionDate },
            take: 1,
          },
          rankings: {
            where: { sessionDate },
            take: 1,
          },
        },
      }),
      prisma.agentRanking.findMany({
        where: { sessionDate },
        orderBy: { rank: "asc" },
        include: { agent: true },
      }),
      prisma.paperPosition.findMany({
        where: { status: { in: ["OPEN", "PARTIAL"] } },
        include: { portfolio: { include: { agent: true } } },
      }),
      prisma.agentDecision.findMany({
        where: { sessionDate },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { agent: true, output: true, order: true },
      }),
      prisma.cioRecommendation.findMany({ where: { sessionDate }, take: 10 }),
      prisma.marketRegimeSnapshot.findUnique({ where: { sessionDate } }),
      prisma.marketContextDaily.findUnique({ where: { sessionDate } }),
      prisma.arenaBattle.findFirst({
        where: { sessionDate },
        orderBy: { createdAt: "desc" },
        include: {
          battleDecisions: {
            include: {
              outcome: true,
              decision: { include: { agent: true, output: true } },
            },
          },
        },
      }),
      loadArenaBattles(),
      prisma.dailyScanRun.findFirst({ orderBy: { runAt: "desc" } }),
    ]);
    const recentBattleRows = allBattles.slice(0, 3);

    const scanNotesDecision =
      latestScanRun?.notes && typeof latestScanRun.notes === "object"
        ? (latestScanRun.notes as { decision?: unknown }).decision
        : undefined;
    const tradingDecision =
      parsePersistedDailyDecision(scanNotesDecision) ??
      computeDailyTradingDecision({
        gate1Level: (latestScanRun?.gate1Level ?? "WARNING") as Gate1Level,
        candidateCountA: latestScanRun?.candidateCountA ?? 0,
        candidateCountB: latestScanRun?.candidateCountB ?? 0,
      });

    const leaderboard = rankings.map((r) => {
      const perf = agents.find((a) => a.id === r.agentId)?.performance[0];
      return {
        agentId: r.agent.slug,
        agentName: r.agent.displayName,
        style: r.agent.style,
        // KHÔNG bịa khi thiếu `agentPerformanceDaily`. Rơi về 0 / vốn ban đầu sẽ
        // dựng một tác tử trông như đã đo: "500 triệu, +0,0%, thắng 0%".
        navVnd: perf ? Number(perf.navVnd) : null,
        pnlPct: perf?.totalReturnPct ?? null,
        realizedPnlVnd: perf ? Number(perf.realizedPnlVnd) : null,
        unrealizedPnlVnd: perf ? Number(perf.unrealizedPnlVnd) : null,
        winRate: perf?.winRate ?? null,
        maxDrawdownPct: perf?.maxDrawdownPct ?? null,
        sharpeLike: perf?.sharpeLike ?? null,
        tradeCount: perf?.tradeCount ?? null,
        openPositions: perf?.openPositions ?? null,
        rank: r.rank,
        rankChange: r.rankChange,
      };
    });

    // Batch portfolio snapshots for all agents in one query (replaces a 2-query-per-agent N+1):
    // bounded lookback window covers both the latest snapshot and the 14-point sparkline.
    const portfolioIds = agents
      .map((a) => a.portfolio?.id)
      .filter((id): id is string => Boolean(id));
    const snapshotLookbackFrom = new Date(sessionDate);
    snapshotLookbackFrom.setUTCDate(
      snapshotLookbackFrom.getUTCDate() - PORTFOLIO_SPARKLINE_LOOKBACK_CALENDAR_DAYS
    );
    const snapshotRows =
      portfolioIds.length > 0
        ? await prisma.portfolioSnapshot.findMany({
            where: { portfolioId: { in: portfolioIds }, sessionDate: { gte: snapshotLookbackFrom } },
            orderBy: [{ portfolioId: "asc" }, { sessionDate: "desc" }],
          })
        : [];
    const snapshotsByPortfolioId = new Map<string, PortfolioSnapshot[]>();
    for (const row of snapshotRows) {
      const arr = snapshotsByPortfolioId.get(row.portfolioId);
      if (arr) arr.push(row);
      else snapshotsByPortfolioId.set(row.portfolioId, [row]);
    }

    // openRiskVnd per portfolio derived from the already-fetched `openPositions` (same status filter)
    // instead of a separate per-agent query.
    const openRiskByPortfolioId = new Map<string, number>();
    for (const p of openPositions) {
      openRiskByPortfolioId.set(
        p.portfolioId,
        (openRiskByPortfolioId.get(p.portfolioId) ?? 0) + Number(p.riskAmountVnd)
      );
    }

    const portfolios = agents.map((a) => {
      const snaps = a.portfolio ? snapshotsByPortfolioId.get(a.portfolio.id) ?? [] : [];
      const snap = snaps[0]; // snaps sorted desc by sessionDate — first is latest
      const perf = a.performance[0];
      const navSparkline = snaps
        .slice(0, 14)
        .map((s) => Number(s.navVnd))
        .reverse();
      const lb = leaderboard.find((r) => r.agentId === a.slug);
      const openRiskVnd = a.portfolio ? openRiskByPortfolioId.get(a.portfolio.id) ?? 0 : 0;

      return {
        agentId: a.slug,
        agentName: a.displayName,
        style: a.style,
        startingCapitalVnd: a.portfolio
          ? Number(a.portfolio.initialCapitalVnd)
          : PAPER_INITIAL_CAPITAL_VND,
        cashVnd: snap
          ? Number(snap.cashVnd)
          : Number(a.portfolio?.cashVnd ?? PAPER_INITIAL_CAPITAL_VND),
        investedVnd: snap ? Number(snap.navVnd) - Number(snap.cashVnd) : 0,
        navVnd: snap
          ? Number(snap.navVnd)
          : perf
            ? Number(perf.navVnd)
            : PAPER_INITIAL_CAPITAL_VND,
        exposurePct: snap?.exposurePct ?? 0,
        sectorExposure: (snap?.sectorExposureJson as Record<string, number>) ?? {},
        openRiskVnd,
        buyingPowerVnd: snap
          ? Math.floor(Number(snap.cashVnd) * 0.99)
          : PAPER_INITIAL_CAPITAL_VND,
        pnlPct: lb?.pnlPct ?? perf?.totalReturnPct ?? 0,
        winRate: lb?.winRate ?? perf?.winRate ?? 0,
        maxDrawdownPct: lb?.maxDrawdownPct ?? perf?.maxDrawdownPct ?? 0,
        // Dưới hai điểm ảnh chụp thì KHÔNG có đường NAV để vẽ. Chèn nguyên vốn
        // ban đầu vào cho đủ hai điểm sẽ vẽ ra một đường phẳng ở 500 triệu —
        // một lịch sử không hề tồn tại. Để rỗng cho `Sparkline` hiện gap.
        navSparkline: navSparkline.length >= 2 ? navSparkline : [],
      };
    });

    // Batch latest close per symbol for all open positions in one round trip (replaces a per-position N+1).
    const positionTickers = [...new Set(openPositions.map((p) => p.symbol))];
    const latestCloseBySymbol = new Map<string, number>();
    if (positionTickers.length > 0) {
      const symbolRows = await prisma.stockSymbol.findMany({
        where: { symbol: { in: positionTickers } },
        select: { id: true, symbol: true },
      });
      const closeBySymbolId = await buildLatestCloseBySymbol(
        prisma,
        symbolRows.map((s) => s.id),
        sessionDate
      );
      for (const s of symbolRows) {
        const close = closeBySymbolId.get(s.id);
        if (close != null) latestCloseBySymbol.set(s.symbol, close);
      }
    }

    const positions = openPositions.map((p) => {
      const mark = latestCloseBySymbol.get(p.symbol) ?? p.avgEntryKvnd;
      const unrealized = Math.round((mark - p.avgEntryKvnd) * 1000 * p.quantity);
      const cost = p.avgEntryKvnd * 1000 * p.quantity;
      const nav = Number(p.portfolio.initialCapitalVnd);
      return {
        id: p.id,
        agentId: p.portfolio.agent.slug,
        agentName: p.portfolio.agent.displayName,
        symbol: p.symbol,
        entryPriceKVnd: p.avgEntryKvnd,
        currentPriceKVnd: mark,
        stopLossKVnd: p.stopLossKvnd,
        takeProfitKVnd: p.takeProfitKvnd,
        quantity: p.quantity,
        allocationPct: nav > 0 ? (cost / nav) * 100 : 0,
        riskAmountVnd: Number(p.riskAmountVnd),
        unrealizedPnlVnd: unrealized,
        unrealizedPnlPct: cost > 0 ? (unrealized / cost) * 100 : 0,
        rMultiple:
          p.avgEntryKvnd > p.stopLossKvnd
            ? (mark - p.avgEntryKvnd) / (p.avgEntryKvnd - p.stopLossKvnd)
            : 0,
        holdingDays: utcDayDiff(sessionDate, p.openedAt),
        status: p.status === "PARTIAL" ? ("PARTIAL" as const) : ("OPEN" as const),
      };
    });

    const decisionRows = decisions.map((d) => {
      const payload = parsePayload(d.output?.payload);
      const explanation = buildDecisionExplanation({
        agentId: d.agent.slug,
        action: d.action as AgentAction,
        symbol: d.symbol,
        reasoningSummary: d.reasoningSummary,
        payload,
      });
      return {
        id: d.id,
        date: d.sessionDate.toISOString().slice(0, 10),
        agentId: d.agent.slug,
        agentName: d.agent.displayName,
        symbol: d.symbol,
        action: d.action as AgentAction,
        confidence: d.confidence,
        reasoningSummary: explanation.summary,
        explanation,
        jsonPayload: (d.output?.payload as Record<string, unknown>) ?? null,
        validationStatus: d.validationStatus as "VALID" | "INVALID" | "SKIPPED",
        linkedOrderId: d.order?.id ?? null,
        linkedPositionId: null,
      };
    });

    const dimensions = regimeSnapshot?.dimensionsJson as RegimeDimensions | undefined;
    const regimeLabels = dimensions
      ? [dimensions.trendRegime, dimensions.volatilityRegime, dimensions.breadthRegime]
      : [];

    // Tác tử chưa có số đo xếp cuối thay vì được coi như 0% — 0% là một kết quả,
    // "chưa đo" thì không.
    const sorted = [...leaderboard]
      .filter((r) => r.pnlPct != null)
      .sort((a, b) => (b.pnlPct as number) - (a.pnlPct as number));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const battleSymbol = battle?.symbol ?? decisions[0]?.symbol ?? "FPT";

    const battleRowsRaw =
      battle?.battleDecisions.map((bd) => {
        const payload = parsePayload(bd.decision.output?.payload);
        const explanation = buildDecisionExplanation({
          agentId: bd.decision.agent.slug,
          action: bd.action as AgentAction,
          symbol: battleSymbol,
          reasoningSummary: bd.reasoning ?? bd.decision.reasoningSummary,
          payload,
        });
        return {
          agentId: bd.decision.agent.slug,
          agentName: bd.decision.agent.displayName,
          style: bd.decision.agent.style,
          action: bd.action as AgentAction,
          confidence: bd.confidence,
          reasoning: explanation.summary,
          explanation,
          outcome: battleOutcomeToDisplay(bd.outcome?.verdict ?? "PENDING") as
            | "WIN"
            | "LOSS"
            | "OPEN"
            | "N/A",
        };
      }) ??
      decisions
        .filter((d) => d.symbol === battleSymbol)
        .map((d) => {
          const payload = parsePayload(d.output?.payload);
          const explanation = buildDecisionExplanation({
            agentId: d.agent.slug,
            action: d.action as AgentAction,
            symbol: d.symbol,
            reasoningSummary: d.reasoningSummary,
            payload,
          });
          return {
            agentId: d.agent.slug,
            agentName: d.agent.displayName,
            style: d.agent.style,
            action: d.action as AgentAction,
            confidence: d.confidence,
            reasoning: explanation.summary,
            explanation,
            outcome: "N/A" as const,
          };
        });

    const panelDecisionsForCio = decisions
      .filter((d) => d.symbol === battleSymbol && d.agent.slug !== "cio")
      .map((d) => ({ action: d.action as AgentAction, agent_id: d.agent.slug }));

    const cioRecommendations = cioRows.map((c) => {
      const p = c.payload as CioRecommendation & { regime_context?: unknown };
      const regimeContext = formatRegimeContext(
        p.regime_context ?? p.metadata?.regime,
        regimeLabels
      );
      const pres = buildCioPresentation(
        { ...p, regime_context: regimeContext },
        panelDecisionsForCio
      );
      return {
        symbol: c.symbol,
        finalAction: p.final_action,
        confidence: p.confidence,
        reasoning: p.reasoning,
        risks: p.risks,
        consensusScore: p.consensus_score,
        consensusLabel: pres.consensusLabel,
        consensusScoreDisplay: pres.consensusScoreDisplay,
        regimeContext,
        decisionSummary: pres.decisionSummary,
        supportingReasons: pres.supportingReasons,
        actionVotes: pres.actionVotes,
        dissentingAgents: p.dissenting_agents.map((d) => ({
          agentId: d.agent_id,
          agentName: agentDisplayName(d.agent_id),
          action: d.action,
          reason: d.reason,
          humanReason: pres.dissent.find((x) => x.agentName === agentDisplayName(d.agent_id))
            ?.humanReason ?? d.reason,
        })),
      };
    });

    const recentBattles = recentBattleRows.map((b) => {
      const votes = countBattleVotes(b.battleDecisions);
      const cioForSymbol = cioRecommendations.find((c) => c.symbol === b.symbol);
      const rowsForInsight = b.battleDecisions.map((d) => ({ action: d.action as AgentAction }));
      return {
        id: b.id,
        sessionDate: b.sessionDate.toISOString().slice(0, 10),
        symbol: b.symbol,
        status: b.status,
        agentCount: b.battleDecisions.length,
        consensusAction: cioForSymbol?.finalAction,
        consensusConfidence: cioForSymbol?.confidence,
        voteCounts: votes,
        insight: buildBattleInsight(rowsForInsight, b.symbol),
      };
    });

    return {
      overview: {
        totalAgents: agentCount,
        totalVirtualCapitalVnd: agentCount * PAPER_INITIAL_CAPITAL_VND,
        performanceSessionDate: perfSessionDate
          ? perfSessionDate.toISOString().slice(0, 10)
          : null,
        bestAgent: best
          ? { id: best.agentId, name: best.agentName, returnPct: best.pnlPct }
          : { id: "-", name: "—", returnPct: null },
        worstAgent: worst
          ? { id: worst.agentId, name: worst.agentName, returnPct: worst.pnlPct }
          : { id: "-", name: "—", returnPct: null },
        totalOpenPositions: positions.length,
        marketRegime: {
          level: (regimeCtx?.gate1Level ?? regimeSnapshot?.gate1Level ?? "WARNING") as
            | "PASS"
            | "WARNING"
            | "FAIL",
          label: regimeLabels.length
            ? regimeLabels.join(" · ")
            : `Gate 1 ${regimeCtx?.gate1Level ?? "WARNING"}`,
          dimensions: dimensions as Record<string, string> | undefined,
          labels: regimeLabels,
          confidence: regimeSnapshot?.confidence,
        },
        tradingDecision: {
          level: tradingDecision.level,
          allocation: tradingDecision.allocation,
          explanation: tradingDecision.explanation,
          scanSessionDate: latestScanRun?.runAt
            ? latestScanRun.runAt.toISOString().slice(0, 10)
            : null,
          funnel: {
            universe: latestScanRun?.symbolCountTotal ?? 0,
            tradable: latestScanRun?.symbolCountAfterTradability ?? 0,
            setups: (latestScanRun?.candidateCountA ?? 0) + (latestScanRun?.candidateCountB ?? 0),
          },
        },
        marketPulse: buildMarketPulse(regimeCtx, dimensions),
        latestEvaluationAt: latestPerf?.createdAt.toISOString() ?? null,
        disclaimer: "PAPER_TRADING_ONLY",
        executionMode: getPaperLabExecutionMode(),
      },
      leaderboard,
      portfolios,
      positions,
      decisions: decisionRows,
      cio: {
        sessionDate: sessionDate.toISOString().slice(0, 10),
        recommendations: cioRecommendations,
      },
      recentBattles,
      battleReplay: {
        sessionDate: sessionDate.toISOString().slice(0, 10),
        symbol: battleSymbol,
        insight: buildBattleInsight(battleRowsRaw, battleSymbol),
        rows: battleRowsRaw,
      },
    };
  }
}
