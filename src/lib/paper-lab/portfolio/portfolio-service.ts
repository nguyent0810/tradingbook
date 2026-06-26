import type { PrismaClient } from "@/generated/prisma/client";
import { computeNotionalVnd } from "@/lib/paper-lab/engine/units";
import { unrealizedPnlVnd } from "@/lib/paper-lab/engine/order-validator";

export type PortfolioState = {
  portfolioId: string;
  agentId: string;
  cashVnd: number;
  navVnd: number;
  investedVnd: number;
  exposurePct: number;
  openPositionCount: number;
  sectorExposure: Record<string, number>;
  openRiskVnd: number;
  buyingPowerVnd: number;
};

export async function computePortfolioState(
  prisma: PrismaClient,
  portfolioId: string,
  marks: Map<string, number>
): Promise<PortfolioState> {
  const portfolio = await prisma.paperPortfolio.findUniqueOrThrow({
    where: { id: portfolioId },
    include: {
      agent: true,
      positions: { where: { status: { in: ["OPEN", "PARTIAL"] } } },
    },
  });

  let investedVnd = 0;
  let openRiskVnd = 0;
  const sectorExposure: Record<string, number> = { UNKNOWN: 0 };

  for (const pos of portfolio.positions) {
    const mark = marks.get(pos.symbol) ?? pos.avgEntryKvnd;
    const notional = computeNotionalVnd(mark, pos.quantity);
    investedVnd += notional;
    openRiskVnd += Number(pos.riskAmountVnd);
    sectorExposure.UNKNOWN = (sectorExposure.UNKNOWN ?? 0) + notional;
  }

  const cashVnd = Number(portfolio.cashVnd);
  const navVnd = cashVnd + investedVnd;
  const exposurePct = navVnd > 0 ? (investedVnd / navVnd) * 100 : 0;

  const sectorPct: Record<string, number> = {};
  for (const [k, v] of Object.entries(sectorExposure)) {
    sectorPct[k] = navVnd > 0 ? (v / navVnd) * 100 : 0;
  }

  return {
    portfolioId,
    agentId: portfolio.agentId,
    cashVnd,
    navVnd,
    investedVnd,
    exposurePct,
    openPositionCount: portfolio.positions.length,
    sectorExposure: sectorPct,
    openRiskVnd,
    buyingPowerVnd: Math.floor(cashVnd * 0.99),
  };
}

export async function snapshotAllPortfolios(
  prisma: PrismaClient,
  sessionDate: Date,
  marks: Map<string, number>
): Promise<void> {
  const portfolios = await prisma.paperPortfolio.findMany({ where: { status: "ACTIVE" } });

  for (const p of portfolios) {
    const state = await computePortfolioState(prisma, p.id, marks);
    const positions = await prisma.paperPosition.findMany({
      where: { portfolioId: p.id, status: { in: ["OPEN", "PARTIAL"] } },
    });

    const holdings = positions.map((pos) => {
      const mark = marks.get(pos.symbol) ?? pos.avgEntryKvnd;
      return {
        symbol: pos.symbol,
        quantity: pos.quantity,
        markKVnd: mark,
        unrealizedPnlVnd: unrealizedPnlVnd(pos.avgEntryKvnd, mark, pos.quantity),
      };
    });

    await prisma.portfolioSnapshot.upsert({
      where: {
        portfolioId_sessionDate: { portfolioId: p.id, sessionDate },
      },
      create: {
        portfolioId: p.id,
        sessionDate,
        navVnd: BigInt(state.navVnd),
        cashVnd: BigInt(state.cashVnd),
        exposurePct: state.exposurePct,
        holdingsJson: holdings,
        sectorExposureJson: state.sectorExposure,
      },
      update: {
        navVnd: BigInt(state.navVnd),
        cashVnd: BigInt(state.cashVnd),
        exposurePct: state.exposurePct,
        holdingsJson: holdings,
        sectorExposureJson: state.sectorExposure,
      },
    });
  }
}
