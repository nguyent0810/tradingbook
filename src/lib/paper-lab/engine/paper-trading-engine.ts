import type { PrismaClient } from "@/generated/prisma/client";
import type { PaperExitReason } from "@/generated/prisma/client";
import type { AgentDecisionOutput } from "@/lib/paper-lab/types/agent-decision.schema";
import { PAPER_DEFAULT_FEE_BPS } from "@/lib/paper-lab/constants";
import {
  computeNotionalVnd,
  computeRMultipleLong,
  computeRiskAtStopVnd,
  calendarDaysBetween,
} from "@/lib/paper-lab/engine/units";
import {
  resolveFillPriceKVnd,
  simulateFeeVnd,
  validateAgentDecisionForExecution,
  type OrderValidationContext,
} from "@/lib/paper-lab/engine/order-validator";
import {
  applyBoardLotToBuyDecision,
  formatBoardLotRejectionReason,
  roundDownSellQuantity,
} from "@/lib/paper-lab/engine/board-lot";

export type ExecuteDecisionParams = {
  portfolioId: string;
  agentDbId: string;
  decisionDbId: string;
  decision: AgentDecisionOutput;
  sessionDate: Date;
  bar: { low: number; high: number; close: number };
  validationCtx: OrderValidationContext;
};

export async function executeValidatedDecision(
  prisma: PrismaClient,
  params: ExecuteDecisionParams
): Promise<{ orderId: string | null; positionId: string | null; rejected: boolean; reason?: string }> {
  const existingOrder = await prisma.paperOrder.findFirst({
    where: { decisionId: params.decisionDbId },
  });
  if (existingOrder) {
    const position = await prisma.paperPosition.findFirst({
      where: {
        portfolioId: params.portfolioId,
        symbol: params.decision.symbol,
        status: { in: ["OPEN", "PARTIAL"] },
      },
    });
    return {
      orderId: existingOrder.id,
      positionId: position?.id ?? null,
      rejected: existingOrder.status === "REJECTED",
      reason: existingOrder.rejectionReason ?? undefined,
    };
  }

  const action = params.decision.action;
  let decisionForExecution = params.decision;

  if (action === "BUY" || action === "ADD") {
    const { decision: rounded, lot } = applyBoardLotToBuyDecision(params.decision);
    if (!lot.ok) {
      return rejectOrder(
        prisma,
        params,
        formatBoardLotRejectionReason(lot)
      );
    }
    decisionForExecution = rounded;
  }

  const validation = validateAgentDecisionForExecution(
    decisionForExecution,
    params.validationCtx
  );
  if (!validation.ok) {
    await prisma.agentDecision.update({
      where: { id: params.decisionDbId },
      data: {
        validationStatus: "INVALID",
        validationErrors: validation.reasons,
      },
    });
    const order = await prisma.paperOrder.create({
      data: {
        portfolioId: params.portfolioId,
        decisionId: params.decisionDbId,
        symbol: params.decision.symbol,
        side: "BUY",
        quantity: decisionForExecution.quantity ?? 0,
        priceKvnd: decisionForExecution.entry_price ?? 0,
        status: "REJECTED",
        rejectionReason: validation.reasons.join("; "),
        sessionDate: params.sessionDate,
      },
    });
    return { orderId: order.id, positionId: null, rejected: true, reason: validation.reasons.join("; ") };
  }

  if (action === "BUY" || action === "ADD") {
    return openOrAddPosition(prisma, { ...params, decision: decisionForExecution });
  }

  if (action === "EXIT" || action === "REDUCE" || action === "SELL") {
    return closeOrReducePosition(prisma, { ...params, decision: decisionForExecution });
  }

  return { orderId: null, positionId: null, rejected: true, reason: "Unsupported action" };
}

async function openOrAddPosition(
  prisma: PrismaClient,
  params: ExecuteDecisionParams
) {
  const { decision, portfolioId, decisionDbId, sessionDate, bar } = params;
  const entry = decision.entry_price!;
  const stop = decision.stop_loss!;
  const tp = decision.take_profit!;
  const qty = decision.quantity!;
  const { fillKVnd } = resolveFillPriceKVnd({
    orderPriceKVnd: entry,
    barLowKVnd: bar.low,
    barHighKVnd: bar.high,
    barCloseKVnd: bar.close,
  });
  const notional = computeNotionalVnd(fillKVnd, qty);
  const fees = simulateFeeVnd(notional, PAPER_DEFAULT_FEE_BPS);

  const portfolio = await prisma.paperPortfolio.findUniqueOrThrow({
    where: { id: portfolioId },
  });

  if (BigInt(notional + fees) > portfolio.cashVnd) {
    return rejectOrder(prisma, params, "Insufficient cash after fees");
  }

  const order = await prisma.paperOrder.create({
    data: {
      portfolioId,
      decisionId: decisionDbId,
      symbol: decision.symbol,
      side: "BUY",
      quantity: qty,
      priceKvnd: fillKVnd,
      status: "FILLED",
      sessionDate,
      filledAt: new Date(),
      feesVnd: BigInt(fees),
    },
  });

  await prisma.paperPortfolio.update({
    where: { id: portfolioId },
    data: { cashVnd: portfolio.cashVnd - BigInt(notional + fees) },
  });

  const existing = await prisma.paperPosition.findFirst({
    where: {
      portfolioId,
      symbol: decision.symbol,
      status: { in: ["OPEN", "PARTIAL"] },
    },
  });

  let positionId: string;
  if (existing && params.decision.action === "ADD") {
    const newQty = existing.quantity + qty;
    const avgEntry =
      (existing.avgEntryKvnd * existing.quantity + fillKVnd * qty) / newQty;
    const updated = await prisma.paperPosition.update({
      where: { id: existing.id },
      data: {
        quantity: newQty,
        avgEntryKvnd: avgEntry,
        stopLossKvnd: stop,
        takeProfitKvnd: tp,
        riskAmountVnd: BigInt(computeRiskAtStopVnd(avgEntry, stop, newQty)),
        status: "OPEN",
      },
    });
    positionId = updated.id;
  } else {
    const created = await prisma.paperPosition.create({
      data: {
        portfolioId,
        symbol: decision.symbol,
        quantity: qty,
        avgEntryKvnd: fillKVnd,
        stopLossKvnd: stop,
        takeProfitKvnd: tp,
        riskAmountVnd: BigInt(computeRiskAtStopVnd(fillKVnd, stop, qty)),
        status: "OPEN",
        openedAt: sessionDate,
        entryDecisionId: decisionDbId,
      },
    });
    positionId = created.id;
  }

  await prisma.agentDecision.update({
    where: { id: decisionDbId },
    data: { validationStatus: "VALID" },
  });

  return { orderId: order.id, positionId, rejected: false };
}

async function closeOrReducePosition(
  prisma: PrismaClient,
  params: ExecuteDecisionParams
) {
  const { portfolioId, decisionDbId, sessionDate, bar, decision } = params;
  const position = await prisma.paperPosition.findFirst({
    where: {
      portfolioId,
      symbol: decision.symbol,
      status: { in: ["OPEN", "PARTIAL"] },
    },
  });

  if (!position) {
    return rejectOrder(prisma, params, "No open position");
  }

  const reduceQtyRaw =
    decision.action === "REDUCE"
      ? Math.max(1, Math.floor(position.quantity / 2))
      : position.quantity;

  const sellLot = roundDownSellQuantity(reduceQtyRaw);
  if (!sellLot.ok) {
    return rejectOrder(prisma, params, formatBoardLotRejectionReason(sellLot));
  }
  const reduceQty = sellLot.quantity;

  const { fillKVnd } = resolveFillPriceKVnd({
    orderPriceKVnd: bar.close,
    barLowKVnd: bar.low,
    barHighKVnd: bar.high,
    barCloseKVnd: bar.close,
  });

  const notional = computeNotionalVnd(fillKVnd, reduceQty);
  const fees = simulateFeeVnd(notional, PAPER_DEFAULT_FEE_BPS);
  const realized = Math.round(
    (fillKVnd - position.avgEntryKvnd) * 1000 * reduceQty - fees
  );

  const order = await prisma.paperOrder.create({
    data: {
      portfolioId,
      decisionId: decisionDbId,
      symbol: decision.symbol,
      side: "SELL",
      quantity: reduceQty,
      priceKvnd: fillKVnd,
      status: "FILLED",
      sessionDate,
      filledAt: new Date(),
      feesVnd: BigInt(fees),
    },
  });

  const portfolio = await prisma.paperPortfolio.findUniqueOrThrow({
    where: { id: portfolioId },
  });

  await prisma.paperPortfolio.update({
    where: { id: portfolioId },
    data: { cashVnd: portfolio.cashVnd + BigInt(notional - fees) },
  });

  const exitReason: PaperExitReason = "AGENT_EXIT";
  const rMult = computeRMultipleLong(position.avgEntryKvnd, fillKVnd, position.stopLossKvnd);

  await prisma.paperTrade.create({
    data: {
      positionId: position.id,
      exitReason,
      quantity: reduceQty,
      entryKvnd: position.avgEntryKvnd,
      exitKvnd: fillKVnd,
      realizedPnlVnd: BigInt(realized),
      rMultiple: rMult,
      holdingDays: calendarDaysBetween(position.openedAt, sessionDate),
      closedSessionDate: sessionDate,
    },
  });

  const remaining = position.quantity - reduceQty;
  if (remaining <= 0) {
    await prisma.paperPosition.update({
      where: { id: position.id },
      data: { quantity: 0, status: "CLOSED", closedAt: sessionDate },
    });
  } else {
    await prisma.paperPosition.update({
      where: { id: position.id },
      data: { quantity: remaining, status: "PARTIAL" },
    });
  }

  await prisma.agentDecision.update({
    where: { id: decisionDbId },
    data: { validationStatus: "VALID" },
  });

  return { orderId: order.id, positionId: position.id, rejected: false };
}

async function rejectOrder(
  prisma: PrismaClient,
  params: ExecuteDecisionParams,
  reason: string
) {
  await prisma.agentDecision.update({
    where: { id: params.decisionDbId },
    data: { validationStatus: "INVALID", validationErrors: [reason] },
  });
  const order = await prisma.paperOrder.create({
    data: {
      portfolioId: params.portfolioId,
      decisionId: params.decisionDbId,
      symbol: params.decision.symbol,
      side: "BUY",
      quantity: params.decision.quantity ?? 0,
      priceKvnd: params.decision.entry_price ?? 0,
      status: "REJECTED",
      rejectionReason: reason,
      sessionDate: params.sessionDate,
    },
  });
  return { orderId: order.id, positionId: null, rejected: true, reason };
}

export async function markPositionsAndDetectExits(
  prisma: PrismaClient,
  sessionDate: Date,
  marks: Map<string, { low: number; high: number; close: number }>
): Promise<number> {
  const open = await prisma.paperPosition.findMany({
    where: { status: { in: ["OPEN", "PARTIAL"] } },
    include: { portfolio: true },
  });

  let closedCount = 0;

  for (const pos of open) {
    const bar = marks.get(pos.symbol);
    if (!bar) continue;

    let exitReason: PaperExitReason | null = null;
    let exitKVnd = bar.close;

    if (bar.low <= pos.stopLossKvnd) {
      exitReason = "STOP_LOSS_HIT";
      exitKVnd = pos.stopLossKvnd;
    } else if (bar.high >= pos.takeProfitKvnd) {
      exitReason = "TAKE_PROFIT_HIT";
      exitKVnd = pos.takeProfitKvnd;
    }

    if (!exitReason) continue;

    const notional = computeNotionalVnd(exitKVnd, pos.quantity);
    const fees = simulateFeeVnd(notional, PAPER_DEFAULT_FEE_BPS);
    const realized = Math.round(
      (exitKVnd - pos.avgEntryKvnd) * 1000 * pos.quantity - fees
    );

    await prisma.paperOrder.create({
      data: {
        portfolioId: pos.portfolioId,
        symbol: pos.symbol,
        side: "SELL",
        quantity: pos.quantity,
        priceKvnd: exitKVnd,
        status: "FILLED",
        sessionDate,
        filledAt: new Date(),
        feesVnd: BigInt(fees),
      },
    });

    await prisma.paperPortfolio.update({
      where: { id: pos.portfolioId },
      data: {
        cashVnd: pos.portfolio.cashVnd + BigInt(notional - fees),
      },
    });

    await prisma.paperTrade.create({
      data: {
        positionId: pos.id,
        exitReason,
        quantity: pos.quantity,
        entryKvnd: pos.avgEntryKvnd,
        exitKvnd: exitKVnd,
        realizedPnlVnd: BigInt(realized),
        rMultiple: computeRMultipleLong(pos.avgEntryKvnd, exitKVnd, pos.stopLossKvnd),
        holdingDays: calendarDaysBetween(pos.openedAt, sessionDate),
        closedSessionDate: sessionDate,
      },
    });

    await prisma.paperPosition.update({
      where: { id: pos.id },
      data: { status: "CLOSED", closedAt: sessionDate, quantity: 0 },
    });

    closedCount += 1;
  }

  return closedCount;
}
