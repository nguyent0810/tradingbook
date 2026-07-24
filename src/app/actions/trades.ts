"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { loadAutoPopulatedTradeLevels } from "@/lib/trades/auto-populate-from-setup";
import { computePositionSizing } from "@/lib/position-sizing";
import { roundDownToBoardLotShares } from "@/lib/paper-lab/engine/board-lot";
import {
  getPositionSizingConfig,
  getTradingAccountEquityVnd,
  type PositionSizingConfigOverrides,
} from "@/lib/trading-account-risk-config";
import { computeOpenPhase2Metrics } from "@/lib/trades/position-health";
import { computePnl } from "@/lib/validations";
import { sortDedupeGate2Bars } from "@/lib/scanner/gate2/breakout-pullback";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { computeMaAtIndex } from "@/lib/scanner/early-entry/bar-metrics";
import {
  computeEarlyEntryRiskReward,
  type InvalidLevelReason,
  type TargetReason,
} from "@/lib/scanner/early-entry/risk-reward";

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

/** Minimum bar history the early-entry stop/target formula needs for a full-quality read. */
const MIN_BARS_FOR_MANUAL_SUGGESTION = 65;

type PositionSizingInputs = {
  equityVnd: number | null;
  sizingConfig: PositionSizingConfigOverrides;
  currentPortfolioExposureVnd: number;
};

/** Shared by every flow that sizes a new position — setup-based and manual alike. */
async function loadPositionSizingInputs(userId: string): Promise<PositionSizingInputs> {
  const [equityVnd, sizingConfig, openTrades] = await Promise.all([
    getTradingAccountEquityVnd(userId),
    getPositionSizingConfig(userId),
    prisma.trade.findMany({
      where: { userId, status: "OPEN" },
      select: { entryPrice: true, quantity: true },
    }),
  ]);
  const currentPortfolioExposureVnd = openTrades.reduce((sum, t) => sum + t.entryPrice * 1000 * t.quantity, 0);
  return { equityVnd, sizingConfig, currentPortfolioExposureVnd };
}

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

  const { equityVnd, sizingConfig, currentPortfolioExposureVnd } = await loadPositionSizingInputs(
    session.userId
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

// ─── Manual trade entry (no scanner setup) ───

function barRowToGate2Input(row: {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}): Gate2BarInput {
  return { date: row.date, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume };
}

export type ManualTradeLevelsPreview =
  | {
      ok: true;
      latestClose: number;
      suggestedStopLoss: number;
      stopReason: InvalidLevelReason;
      suggestedTakeProfit: number;
      targetReason: TargetReason;
      riskRewardRatio: number | null;
      suggestedQuantity: number | null;
      asOfBarDate: string;
    }
  | { ok: false; message: string };

/**
 * Formula-based stop/target suggestion for a symbol with no scanner setup —
 * reuses the early-entry module's own technical read (swing/compression/MA/ATR
 * candidates for the stop, structural resistance for the target), the same
 * engine `auto-populate-from-setup.ts` partially reuses for setup-based
 * trades. Read-only — no trade is created here.
 */
export async function previewManualTradeLevels(symbolInput: string): Promise<ManualTradeLevelsPreview> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const symbol = symbolInput.trim().toUpperCase();
  if (!symbol) {
    return { ok: false, message: "Vui lòng nhập mã cổ phiếu." };
  }

  const stockSymbol = await prisma.stockSymbol.findUnique({ where: { symbol } });
  if (!stockSymbol) {
    return {
      ok: false,
      message: "Mã chưa được hệ thống theo dõi — không thể tính gợi ý hoặc theo dõi sức khỏe tự động cho mã này.",
    };
  }

  const rows = await prisma.stockDailyBar.findMany({
    where: { symbolId: stockSymbol.id },
    orderBy: { date: "desc" },
    take: 120,
    select: { date: true, open: true, high: true, low: true, close: true, volume: true },
  });
  if (rows.length < MIN_BARS_FOR_MANUAL_SUGGESTION) {
    return { ok: false, message: "Không đủ dữ liệu lịch sử giá để tính gợi ý (tối thiểu 65 phiên)." };
  }

  const bars = sortDedupeGate2Bars(rows.reverse().map(barRowToGate2Input));
  const idx = bars.length - 1;
  const close = bars[idx]!.close;
  const { ma20, ma50 } = computeMaAtIndex(bars, idx);
  const result = computeEarlyEntryRiskReward(bars, idx, ma20, ma50);
  if (result.stopLevel == null || result.targetPrice == null || result.invalidLevelReason == null || result.targetReason == null) {
    return { ok: false, message: "Không tìm được mức cắt lỗ/chốt lãi hợp lệ từ dữ liệu giá gần đây của mã này." };
  }

  const { equityVnd, sizingConfig, currentPortfolioExposureVnd } = await loadPositionSizingInputs(session.userId);
  // No scanner quality tier for a manual entry — use the more conservative
  // Tier-B risk multiplier (half budget) rather than assuming Tier A.
  const sizing = computePositionSizing({
    accountEquityVnd: equityVnd ?? DEFAULT_EQUITY_VND,
    maxPortfolioExposurePct: DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT,
    currentPortfolioExposureVnd,
    maxPerTradeExposurePct: sizingConfig.maxPositionPct ?? DEFAULT_MAX_PER_TRADE_PCT,
    baseRiskPerTradePct: sizingConfig.riskPerTradePct ?? DEFAULT_BASE_RISK_PER_TRADE_PCT,
    quality: "B",
    entryKVnd: close,
    stopKVnd: result.stopLevel,
    liquidityCapPct: sizingConfig.liquidityCapPct ?? DEFAULT_LIQUIDITY_CAP_PCT,
    symbolAvgDailyValueVnd: null,
  });
  const suggestedQuantity = sizing.ok ? roundDownToBoardLotShares(sizing.value.qFinalShares) : null;

  return {
    ok: true,
    latestClose: close,
    suggestedStopLoss: result.stopLevel,
    stopReason: result.invalidLevelReason,
    suggestedTakeProfit: result.targetPrice,
    targetReason: result.targetReason,
    riskRewardRatio: result.riskRewardRatio,
    suggestedQuantity: suggestedQuantity?.ok ? suggestedQuantity.quantity : null,
    asOfBarDate: bars[idx]!.date.toISOString(),
  };
}

const ManualTradeSchema = z.object({
  symbol: z
    .string()
    .min(1, "Vui lòng nhập mã cổ phiếu.")
    .max(10, "Mã cổ phiếu quá dài.")
    .transform((v) => v.toUpperCase().trim()),
  entryPrice: z.coerce.number().positive("Giá vào lệnh phải là số dương."),
  quantity: z.coerce.number().positive("Khối lượng phải là số dương."),
  stopLoss: z.coerce.number().positive("Cắt lỗ phải là số dương."),
  takeProfit: z.coerce.number().positive("Chốt lãi phải là số dương.").optional().or(z.literal("")),
  fees: z.coerce.number().min(0, "Phí không được âm.").default(0),
  notes: z.string().max(2000, "Ghi chú quá dài.").optional().default(""),
});

/**
 * Trades logged outside a scanner setup — e.g. a symbol/thesis the scanner
 * never surfaced. Requires the symbol to already be tracked (StockSymbol +
 * daily bars) so the nightly health-check job can actually monitor it; a
 * trade the system can't price would sit unwatched, defeating the whole
 * point of automated tracking.
 */
export async function createManualTrade(
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = ManualTradeSchema.safeParse({
    symbol: formData.get("symbol"),
    entryPrice: formData.get("entryPrice"),
    quantity: formData.get("quantity"),
    stopLoss: formData.get("stopLoss"),
    takeProfit: formData.get("takeProfit"),
    fees: formData.get("fees"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { symbol, entryPrice, quantity, stopLoss, takeProfit, fees, notes } = parsed.data;

  if (entryPrice <= stopLoss) {
    return { errors: { stopLoss: ["Cắt lỗ phải thấp hơn giá vào lệnh."] } };
  }

  const stockSymbol = await prisma.stockSymbol.findUnique({ where: { symbol } });
  if (!stockSymbol) {
    return {
      message: "Mã chưa được hệ thống theo dõi — không thể ghi lệnh (sẽ không được theo dõi sức khỏe tự động).",
    };
  }

  const trade = await prisma.trade.create({
    data: {
      userId: session.userId,
      setupId: null,
      symbol,
      direction: "LONG",
      status: "OPEN",
      entryDate: new Date(),
      entryPrice,
      quantity,
      stopLoss,
      takeProfit: takeProfit === "" || takeProfit == null ? null : takeProfit,
      fees,
      notes: notes || null,
      positionSize: entryPrice * quantity,
    },
  });

  revalidatePath("/book");

  return {
    success: true,
    message: `Đã ghi lệnh thủ công ${trade.symbol} — ${quantity.toLocaleString("en-US")} cp @ ${entryPrice.toLocaleString("en-US")} nghìn ₫.`,
  };
}
