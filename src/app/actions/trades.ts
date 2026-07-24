"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { loadAutoPopulatedTradeLevels } from "@/lib/trades/auto-populate-from-setup";
import { computePositionSizing } from "@/lib/position-sizing";
import { roundDownToBoardLotShares } from "@/lib/paper-lab/engine/board-lot";
import { getPositionSizingConfig, getTradingAccountEquityVnd } from "@/lib/trading-account-risk-config";
import { computeOpenPhase2Metrics } from "@/lib/trades/position-health";
import { computePnl } from "@/lib/validations";

export type TradeActionState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
      success?: boolean;
    }
  | undefined;

// Same fallbacks the what-if sizing panel on /setups uses (setups-candidate-position-sizing.tsx)
// when the user hasn't set overrides in Settings — kept identical for consistency.
const DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT = 0.7;
const DEFAULT_MAX_PER_TRADE_PCT = 0.2;
const DEFAULT_BASE_RISK_PER_TRADE_PCT = 0.01;
const DEFAULT_LIQUIDITY_CAP_PCT = 0.1;
const DEFAULT_EQUITY_VND = 500_000_000;

// ─── Preview auto-populated levels (before the user commits to a fill price) ───

export type SetupLevelsPreview =
  | {
      ok: true;
      entryRangeLow: number;
      entryRangeHigh: number;
      suggestedEntry: number;
      stopLoss: number;
      takeProfit: number | null;
      riskRewardRatio: number | null;
      asOfBarDate: string;
    }
  | { ok: false; message: string };

/** Read-only preview for the "Ghi lệnh" panel — no trade is created here. */
export async function previewTradeLevelsForSetup(setupId: string): Promise<SetupLevelsPreview> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const setup = await prisma.setupCandidate.findUnique({ where: { id: setupId } });
  if (!setup) {
    return { ok: false, message: "Không tìm thấy setup." };
  }

  const levels = await loadAutoPopulatedTradeLevels(prisma, {
    symbolId: setup.symbolId,
    close: setup.close,
    breakoutLevel: setup.breakoutLevel,
    pullbackZoneLow: setup.pullbackZoneLow,
    pullbackZoneHigh: setup.pullbackZoneHigh,
    stopLevel: setup.stopLevel,
    barDate: setup.barDate,
  });
  if (!levels) {
    return { ok: false, message: "Không đủ dữ liệu lịch sử giá để tự động tính lệnh cho mã này." };
  }

  return {
    ok: true,
    entryRangeLow: levels.entryRangeLow,
    entryRangeHigh: levels.entryRangeHigh,
    suggestedEntry: levels.suggestedEntry,
    stopLoss: levels.stopLoss,
    takeProfit: levels.takeProfit,
    riskRewardRatio: levels.riskRewardRatio,
    asOfBarDate: levels.asOfBarDate.toISOString(),
  };
}

// ─── Log trade (confirm fill price from an auto-populated setup) ───

const ConfirmEntrySchema = z.object({
  setupId: z.string().min(1, "Thiếu setup."),
  confirmedEntryPrice: z.coerce.number().positive("Giá vào lệnh phải là số dương."),
});

/**
 * Only the fill-price confirmation is manual — stop/target/R:R and position
 * size are all derived from the setup and the account's risk config. Creates
 * the trade directly as OPEN (confirming the fill is what starts tracking).
 */
export async function createTradeFromSetup(
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = ConfirmEntrySchema.safeParse({
    setupId: formData.get("setupId"),
    confirmedEntryPrice: formData.get("confirmedEntryPrice"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { setupId, confirmedEntryPrice } = parsed.data;

  const setup = await prisma.setupCandidate.findUnique({
    where: { id: setupId },
    include: { symbol: { select: { symbol: true } } },
  });
  if (!setup) {
    return { message: "Không tìm thấy setup." };
  }

  const existing = await prisma.trade.findFirst({
    where: { setupId, userId: session.userId, status: { in: ["PLANNED", "OPEN"] } },
  });
  if (existing) {
    return { message: "Đã có lệnh đang mở hoặc lên kế hoạch từ setup này." };
  }

  const levels = await loadAutoPopulatedTradeLevels(prisma, {
    symbolId: setup.symbolId,
    close: setup.close,
    breakoutLevel: setup.breakoutLevel,
    pullbackZoneLow: setup.pullbackZoneLow,
    pullbackZoneHigh: setup.pullbackZoneHigh,
    stopLevel: setup.stopLevel,
    barDate: setup.barDate,
  });
  if (!levels) {
    return { message: "Không đủ dữ liệu lịch sử giá để tự động tính lệnh cho mã này." };
  }

  if (confirmedEntryPrice <= levels.stopLoss) {
    return { errors: { confirmedEntryPrice: ["Giá vào lệnh phải cao hơn giá cắt lỗ."] } };
  }

  const [equityVnd, sizingConfig, openTrades] = await Promise.all([
    getTradingAccountEquityVnd(session.userId),
    getPositionSizingConfig(session.userId),
    prisma.trade.findMany({
      where: { userId: session.userId, status: "OPEN" },
      select: { entryPrice: true, quantity: true },
    }),
  ]);
  const currentPortfolioExposureVnd = openTrades.reduce(
    (sum, t) => sum + t.entryPrice * 1000 * t.quantity,
    0
  );

  const sizing = computePositionSizing({
    accountEquityVnd: equityVnd ?? DEFAULT_EQUITY_VND,
    maxPortfolioExposurePct: DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT,
    currentPortfolioExposureVnd,
    maxPerTradeExposurePct: sizingConfig.maxPositionPct ?? DEFAULT_MAX_PER_TRADE_PCT,
    baseRiskPerTradePct: sizingConfig.riskPerTradePct ?? DEFAULT_BASE_RISK_PER_TRADE_PCT,
    quality: setup.quality,
    entryKVnd: confirmedEntryPrice,
    stopKVnd: levels.stopLoss,
    liquidityCapPct: sizingConfig.liquidityCapPct ?? DEFAULT_LIQUIDITY_CAP_PCT,
    symbolAvgDailyValueVnd: null,
  });

  if (!sizing.ok) {
    return {
      message:
        sizing.code === "ZERO_EQUITY"
          ? "Vốn tài khoản chưa hợp lệ — kiểm tra lại trong Cài đặt."
          : "Không thể tính khối lượng lệnh hợp lệ từ giá vào và cắt lỗ này.",
    };
  }

  const lot = roundDownToBoardLotShares(sizing.value.qFinalShares);
  if (!lot.ok) {
    return { message: "Khối lượng tính được dưới 1 lô (100 cổ phiếu) — dư địa rủi ro/tỷ trọng hiện không đủ." };
  }

  const entryLocationVsZone =
    confirmedEntryPrice > setup.pullbackZoneHigh
      ? "ABOVE_ZONE"
      : confirmedEntryPrice < setup.pullbackZoneLow
        ? "BELOW_ZONE"
        : "IN_ZONE";

  const trade = await prisma.trade.create({
    data: {
      userId: session.userId,
      setupId: setup.id,
      symbol: setup.symbol.symbol,
      direction: "LONG",
      status: "OPEN",
      entryDate: new Date(),
      entryPrice: confirmedEntryPrice,
      quantity: lot.quantity,
      stopLoss: levels.stopLoss,
      takeProfit: levels.takeProfit,
      positionSize: sizing.value.notionalVnd,
      entryLocationVsZone,
      setupSnapshot: {
        quality: setup.quality,
        breakoutLevel: setup.breakoutLevel,
        pullbackZoneLow: setup.pullbackZoneLow,
        pullbackZoneHigh: setup.pullbackZoneHigh,
        entryRangeLow: levels.entryRangeLow,
        entryRangeHigh: levels.entryRangeHigh,
        targetReason: levels.targetReason,
        riskRewardRatio: levels.riskRewardRatio,
        asOfBarDate: levels.asOfBarDate.toISOString(),
      },
    },
  });

  revalidatePath("/book");
  revalidatePath("/setups");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Đã ghi lệnh ${trade.symbol} — ${lot.quantity.toLocaleString("en-US")} cp @ ${confirmedEntryPrice.toLocaleString("en-US")} nghìn ₫.`,
  };
}

// ─── Close trade ───

const CloseTradeSchema = z.object({
  tradeId: z.string().min(1, "Thiếu lệnh."),
  exitPrice: z.coerce.number().positive("Giá thoát lệnh phải là số dương."),
  exitReason: z
    .enum([
      "TAKE_PROFIT_HIT",
      "STOP_LOSS_HIT",
      "ZONE_INVALIDATED",
      "STRUCTURE_BROKEN",
      "HEALTH_DEGRADED_EOD",
      "TIME_STOP",
      "MANUAL_RULE_BASED_EXIT",
    ])
    .optional()
    .or(z.literal("")),
  exitDiscipline: z
    .enum(["FOLLOWED_PLAN", "EARLY_EXIT_RULE_BASED", "EMOTIONAL_EXIT", "RULE_VIOLATION"])
    .optional()
    .or(z.literal("")),
  exitNote: z.string().max(2000, "Ghi chú quá dài.").optional().default(""),
});

export async function closeTrade(
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = CloseTradeSchema.safeParse({
    tradeId: formData.get("tradeId"),
    exitPrice: formData.get("exitPrice"),
    exitReason: formData.get("exitReason"),
    exitDiscipline: formData.get("exitDiscipline"),
    exitNote: formData.get("exitNote"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { tradeId, exitPrice, exitReason, exitDiscipline, exitNote } = parsed.data;

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade || trade.userId !== session.userId) {
    return { message: "Không tìm thấy lệnh." };
  }
  if (trade.status !== "OPEN") {
    return { message: "Lệnh này không ở trạng thái đang mở." };
  }

  const realizedPnl = computePnl(trade.direction, trade.entryPrice, exitPrice, trade.quantity, trade.fees);
  const { rMultiple } = computeOpenPhase2Metrics({
    direction: trade.direction,
    entryPrice: trade.entryPrice,
    latestClose: exitPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
  });
  const outcome = realizedPnl > 0 ? "WIN" : realizedPnl < 0 ? "LOSS" : "BREAKEVEN";

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      status: "CLOSED",
      exitDate: new Date(),
      exitPrice,
      realizedPnl,
      rMultiple,
      outcome,
      exitReason: exitReason || null,
      exitDiscipline: exitDiscipline || null,
      exitNote: exitNote || null,
    },
  });

  revalidatePath("/book");
  revalidatePath("/dashboard");

  return { success: true, message: `Đã đóng lệnh ${trade.symbol}.` };
}
