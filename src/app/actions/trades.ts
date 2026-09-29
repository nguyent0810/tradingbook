"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadSymbolAdvVnd } from "@/lib/trades/symbol-adv";
import { getSession } from "@/lib/session";
import { loadSetupTradeSuggestion } from "@/lib/trades/load-screen-trade-suggestions";
import {
  buildOrderTicketPrefill,
  DEFAULT_TARGET_R,
  type OrderTicketPrefillResult,
} from "@/lib/trades/order-ticket-prefill";
import { checkConfirmedQuantity, logTradeShareCeiling } from "@/lib/trades/reference-size";
import type { TradeSuggestionSnapshot } from "@/lib/trades/trade-suggestion-snapshot";
import { resolveExchange } from "@/lib/market/exchange-rules";
import type { Prisma } from "@/generated/prisma/client";
import { POSITION_SIZING_DEFAULTS, computePositionSizing, openExposureVnd } from "@/lib/position-sizing";
import { loadTerminalVerdict } from "@/lib/terminal/load-terminal-verdict";
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
// Mặc định định cỡ dùng CHUNG với các màn — xem `POSITION_SIZING_DEFAULTS`.
const {
  maxPortfolioExposurePct: DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT,
  maxPerTradeExposurePct: DEFAULT_MAX_PER_TRADE_PCT,
  baseRiskPerTradePct: DEFAULT_BASE_RISK_PER_TRADE_PCT,
  liquidityCapPct: DEFAULT_LIQUIDITY_CAP_PCT,
} = POSITION_SIZING_DEFAULTS;

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
  const currentPortfolioExposureVnd = openExposureVnd(
    openTrades.map((t) => ({ entryKvnd: t.entryPrice, quantity: t.quantity }))
  );
  return { equityVnd, sizingConfig, currentPortfolioExposureVnd };
}

// ─── Order-ticket preview: the trade suggestion's own numbers (#17) ───

export type SetupLevelsPreview = OrderTicketPrefillResult;

/**
 * Read-only preview for the order ticket — no trade is created here.
 *
 * It returns the SAME Gợi ý lệnh F1/F2/F7 show (one loader, one builder), so
 * the ticket pre-fills entry = entry-zone top, stop = stop-zone low, the
 * 1R/2R/3R targets and the reference size (net R + Đệm gap). The verdict is the
 * server's own, the one `createTradeFromSetup()` applies.
 */
export async function previewTradeLevelsForSetup(setupId: string): Promise<SetupLevelsPreview> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const setup = await prisma.setupCandidate.findUnique({ where: { id: setupId } });
  if (!setup) {
    return { ok: false, message: "Không tìm thấy setup." };
  }

  const verdict = await loadTerminalVerdict();
  const loaded = await loadSetupTradeSuggestion({
    userId: session.userId,
    setup,
    verdictLevel: verdict.level,
  });
  return buildOrderTicketPrefill(loaded.result, loaded.sizingUnavailable);
}

// ─── Log trade from a setup (journal entry only; the app never places orders, ADR 0003) ───

/** Blank form fields read as "not given", not as 0. */
const blankToUndefined = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === "" ? undefined : v;

const ConfirmEntrySchema = z.object({
  setupId: z.string().min(1, "Thiếu setup."),
  confirmedEntryPrice: z.coerce.number().positive("Giá vào lệnh phải là số dương."),
  /** Cắt lỗ trên phiếu (kVND). Bỏ trống = đáy vùng SL của gợi ý lệnh. */
  confirmedStopLoss: z.preprocess(
    blankToUndefined,
    z.coerce.number().positive("Cắt lỗ phải là số dương.").optional()
  ),
  /** Chốt lời trên phiếu (kVND). Bỏ trống = mốc 2R của gợi ý lệnh. */
  confirmedTakeProfit: z.preprocess(
    blankToUndefined,
    z.coerce.number().positive("Chốt lời phải là số dương.").optional()
  ),
  /**
   * Khối lượng người dùng chốt trên phiếu. Bỏ trống = trần server tính.
   *
   * Chỉ được **nhỏ hơn hoặc bằng** trần mà server tự dựng lại (rủi ro xấu nhất có
   * đệm gap, trần tỷ trọng/thanh khoản, lô 100, phán quyết phiên) tại giá vào và
   * cắt lỗ của phiếu. Server không bao giờ nới nó lên.
   */
  confirmedQuantity: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int("Khối lượng phải là số nguyên.")
      .positive("Khối lượng phải là số dương.")
      .optional()
  ),
});

/**
 * Records a trade the user took from a setup's Gợi ý lệnh. The ticket sends the
 * entry, stop, target and quantity it showed (every one editable); the server
 * rebuilds the suggestion, re-reads every sizing input itself, checks the
 * quantity against its own worst-case ceiling, and saves the suggestion as it
 * stood, time-stamped, next to the setup snapshot. Creates the trade as OPEN.
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
    confirmedStopLoss: formData.get("confirmedStopLoss"),
    confirmedTakeProfit: formData.get("confirmedTakeProfit"),
    confirmedQuantity: formData.get("confirmedQuantity"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { setupId, confirmedEntryPrice } = parsed.data;

  const setup = await prisma.setupCandidate.findUnique({
    where: { id: setupId },
    include: { symbol: { select: { symbol: true, exchange: true } } },
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

  const [{ equityVnd, sizingConfig, currentPortfolioExposureVnd }, verdict, adv] =
    await Promise.all([
      loadPositionSizingInputs(session.userId),
      loadTerminalVerdict(),
      loadSymbolAdvVnd(prisma, setup.symbolId, setup.barDate),
    ]);

  // Fail closed: đọc ADV hỏng ⇒ KHÔNG ghi lệnh. Ghi tiếp với ADV rỗng nghĩa là
  // bỏ trần thanh khoản đúng lúc không ai biết trần đó lẽ ra bằng bao nhiêu.
  if (!adv.ok) {
    return {
      message:
        "Không đọc được giá trị giao dịch bình quân của mã nên không kiểm được trần thanh khoản — " +
        "chưa ghi lệnh. Thử lại sau. " +
        adv.error,
    };
  }

  // Gợi ý lệnh như lúc ghi: cùng bộ nạp các màn dùng, cùng phán quyết server vừa
  // đọc. Nó là mặc định cho ô bỏ trống và là bản chụp lưu kèm lệnh.
  const loaded = await loadSetupTradeSuggestion({
    userId: session.userId,
    setup,
    verdictLevel: verdict.level,
  });
  const suggestionResult = loaded.result;
  if (!suggestionResult || !suggestionResult.ok) {
    return {
      message: `Không dựng được gợi ý lệnh cho setup này nên chưa ghi lệnh — ${
        suggestionResult?.detail ?? "không nạp được nến hoặc sàn của mã"
      }.`,
    };
  }
  const suggestion = suggestionResult.suggestion;

  const stopKvnd = parsed.data.confirmedStopLoss ?? suggestion.stopZone.low;
  const defaultTarget = suggestion.targets.find((t) => t.r === DEFAULT_TARGET_R);
  const takeProfitKvnd = parsed.data.confirmedTakeProfit ?? defaultTarget?.price ?? null;
  if (confirmedEntryPrice <= stopKvnd) {
    return { errors: { confirmedStopLoss: ["Cắt lỗ phải thấp hơn giá vào lệnh."] } };
  }
  if (takeProfitKvnd != null && takeProfitKvnd <= confirmedEntryPrice) {
    return { errors: { confirmedTakeProfit: ["Chốt lời phải cao hơn giá vào lệnh."] } };
  }

  // Trần của SERVER, tính lại từ đầu vào tự đọc, cùng quy tắc với size tham khảo
  // (rủi ro xấu nhất = R sau phí + đệm gap), tại giá vào và cắt lỗ của phiếu.
  const ceiling = logTradeShareCeiling({
    equityVnd,
    riskPerTradePct: sizingConfig.riskPerTradePct ?? DEFAULT_BASE_RISK_PER_TRADE_PCT,
    maxPerTradeExposurePct: sizingConfig.maxPositionPct ?? DEFAULT_MAX_PER_TRADE_PCT,
    maxPortfolioExposurePct: DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT,
    liquidityCapPct: sizingConfig.liquidityCapPct ?? DEFAULT_LIQUIDITY_CAP_PCT,
    currentExposureVnd: currentPortfolioExposureVnd,
    tier: setup.quality === "A" ? "A" : "B",
    exchange: resolveExchange(setup.symbol.exchange).exchange,
    entryKvnd: confirmedEntryPrice,
    stopKvnd,
    advVnd: adv.value,
    verdictLevel: verdict.level,
    verdictBlockedReason: verdict.blockedReason ?? null,
  });
  if (!ceiling.ok) {
    return { message: ceiling.message };
  }
  const lot = checkConfirmedQuantity(ceiling, parsed.data.confirmedQuantity ?? null);
  if (!lot.ok) {
    return { errors: { confirmedQuantity: [lot.message] } };
  }

  const entryLocationVsZone =
    confirmedEntryPrice > setup.pullbackZoneHigh
      ? "ABOVE_ZONE"
      : confirmedEntryPrice < setup.pullbackZoneLow
        ? "BELOW_ZONE"
        : "IN_ZONE";

  // Which Mốc chốt the target is, when it is one; a hand-typed target has none.
  const targetR = suggestion.targets.find((t) => t.price === takeProfitKvnd)?.r ?? null;
  const suggestionSnapshot: TradeSuggestionSnapshot = { schemaVersion: 1, targetR, suggestion };

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
      stopLoss: stopKvnd,
      takeProfit: takeProfitKvnd,
      // Giá trị vị thế phải khớp khối lượng thực ghi.
      positionSize: lot.quantity * confirmedEntryPrice * 1000,
      entryLocationVsZone,
      setupSnapshot: {
        quality: setup.quality,
        breakoutLevel: setup.breakoutLevel,
        pullbackZoneLow: setup.pullbackZoneLow,
        pullbackZoneHigh: setup.pullbackZoneHigh,
        entryRangeLow: suggestion.entryZone.low,
        entryRangeHigh: suggestion.entryZone.high,
        asOfBarDate: suggestion.asOfSession,
      },
      suggestionSnapshot: suggestionSnapshot as unknown as Prisma.InputJsonValue,
      suggestionSnapshotAt: new Date(),
    },
  });

  revalidatePath("/book");
  revalidatePath("/setups");
  revalidatePath("/dashboard");
  // F7 cũng định cỡ theo `currentPortfolioExposureVnd`. Đường dẫn động cần
  // `type: "page"` (xem `next/dist/docs/.../revalidatePath.md`), và làm mới mọi
  // mã chứ không riêng mã vừa ghi: trần danh mục là số dùng chung.
  revalidatePath("/symbol/[symbol]", "page");

  return {
    success: true,
    message: `Đã ghi lệnh ${trade.symbol} — ${lot.quantity.toLocaleString("vi-VN")} cp @ ${confirmedEntryPrice.toLocaleString("vi-VN")} nghìn ₫.`,
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

  // Đóng vị thế làm GIẢM `currentPortfolioExposureVnd` — F2/F7 định cỡ lệnh sau
  // trên số đó, nên phải làm mới cùng bộ như hai đường ghi lệnh.
  revalidatePath("/book");
  revalidatePath("/setups");
  revalidatePath("/dashboard");
  revalidatePath("/symbol/[symbol]", "page");

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
      /**
       * Vì sao không gợi ý được khối lượng — `null` khi gợi ý được.
       *
       * Bắt buộc có: một `suggestedQuantity: null` trơn khiến giao diện phải tự
       * đoán lý do, và trước đây nó đoán sai ("chưa đặt vốn") kể cả khi thật ra
       * truy vấn ADV hỏng.
       */
      suggestedQuantityBlockedReason: string | null;
      asOfBarDate: string;
    }
  | { ok: false; message: string };

/**
 * Formula-based stop/target suggestion for a symbol with no scanner setup —
 * reuses the early-entry module's own technical read (swing/compression/MA/ATR
 * candidates for the stop, structural resistance for the target). A setup
 * has a Gợi ý lệnh instead (`previewTradeLevelsForSetup`); a symbol without one
 * keeps this path. Read-only — no trade is created here.
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

  const [{ equityVnd, sizingConfig, currentPortfolioExposureVnd }, adv] = await Promise.all([
    loadPositionSizingInputs(session.userId),
    loadSymbolAdvVnd(prisma, stockSymbol.id, bars[idx]!.date),
  ]);
  // ADV hỏng ⇒ KHÔNG gợi ý khối lượng. Trước đây chỗ này ép lỗi thành `null` với
  // lý lẽ "chỉ là gợi ý" — nhưng bỏ trần thanh khoản vì một lỗi truy vấn thì con
  // số gợi ý có thể RỘNG HƠN thực tế, mà giao diện lại không có gì để nói ra
  // điều đó. Thiếu hàng ADV (`ok: true, value: null`) là chuyện khác: khi đó cả
  // hệ thống cùng không có trần, và gợi ý vẫn đúng với những gì biết được.
  //
  // No scanner quality tier for a manual entry — use the more conservative
  // Tier-B risk multiplier (half budget) rather than assuming Tier A.
  const sizing = adv.ok
    ? computePositionSizing({
        // Vốn chưa đặt ⇒ `ZERO_EQUITY` ⇒ không gợi ý. Dựng gợi ý trên một con số
        // vốn mặc định là gợi ý sai.
        accountEquityVnd: equityVnd ?? 0,
        maxPortfolioExposurePct: DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT,
        currentPortfolioExposureVnd,
        maxPerTradeExposurePct: sizingConfig.maxPositionPct ?? DEFAULT_MAX_PER_TRADE_PCT,
        baseRiskPerTradePct: sizingConfig.riskPerTradePct ?? DEFAULT_BASE_RISK_PER_TRADE_PCT,
        quality: "B",
        entryKVnd: close,
        stopKVnd: result.stopLevel,
        liquidityCapPct: sizingConfig.liquidityCapPct ?? DEFAULT_LIQUIDITY_CAP_PCT,
        symbolAvgDailyValueVnd: adv.value,
      })
    : null;
  const lot = sizing?.ok ? roundDownToBoardLotShares(sizing.value.qFinalShares) : null;
  const suggestedQuantityBlockedReason = !adv.ok
    ? `Không đọc được giá trị giao dịch bình quân của mã nên không kiểm được trần thanh khoản. ${adv.error}`
    : sizing == null || !sizing.ok
      ? "Chưa đặt vốn tài khoản ở Cài đặt (F5) nên chưa gợi ý được khối lượng."
      : lot == null || !lot.ok
        ? "Khối lượng gợi ý dưới 1 lô (100 cổ phiếu)."
        : null;

  return {
    ok: true,
    latestClose: close,
    suggestedStopLoss: result.stopLevel,
    stopReason: result.invalidLevelReason,
    suggestedTakeProfit: result.targetPrice,
    targetReason: result.targetReason,
    riskRewardRatio: result.riskRewardRatio,
    suggestedQuantity: lot?.ok ? lot.quantity : null,
    suggestedQuantityBlockedReason,
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
 *
 * KHỐI LƯỢNG Ở ĐÂY KHÔNG BỊ CHẶN THEO ĐỊNH CỠ, VÀ ĐÓ LÀ CÓ CHỦ ĐÍCH.
 *
 * Bàn giao §5 ghi rõ modal này "dùng cho lệnh khớp NGOÀI hệ thống" — nó ghi lại
 * một giao dịch ĐÃ xảy ra, không phải đặt một lệnh mới. Từ chối ghi vì vượt trần
 * thanh khoản sẽ là từ chối ghi nhận sự thật: sổ lệnh mất một vị thế đang mở
 * thật, `currentPortfolioExposureVnd` tính thiếu, và mọi lệnh sau đó lại được
 * định cỡ RỘNG hơn mức đúng. Chặn ở đây làm hệ thống kém an toàn hơn, không phải
 * an toàn hơn.
 *
 * Thay vì chặn, khi khối lượng ghi vào vượt mức mà tham số rủi ro cho phép thì
 * nói thẳng điều đó trong thông báo — người dùng biết vị thế nằm ngoài chính
 * sách, còn hệ thống vẫn ghi đúng thực tế.
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
      // Giá lưu theo nghìn ₫/cp nên phải nhân 1.000 để `positionSize` là ĐỒNG —
      // cùng đơn vị mà đường ghi lệnh từ thiết lập đang dùng.
      positionSize: entryPrice * quantity * 1000,
    },
  });

  // Vị thế mở mới làm `currentPortfolioExposureVnd` đổi, mà F1/F2/F7 đều định cỡ
  // lệnh SAU dựa trên số đó — phải làm mới đúng như đường ghi lệnh từ thiết lập,
  // nếu không các màn kia vẫn hiện khối lượng tính trên exposure cũ.
  revalidatePath("/book");
  revalidatePath("/setups");
  revalidatePath("/dashboard");
  revalidatePath("/symbol/[symbol]", "page");

  const overLimit = await describeManualSizeOverrun({
    userId: session.userId,
    symbolId: stockSymbol.id,
    entryKVnd: entryPrice,
    stopKVnd: stopLoss,
    quantity,
  });

  return {
    success: true,
    message:
      `Đã ghi lệnh thủ công ${trade.symbol} — ${quantity.toLocaleString("vi-VN")} cp @ ${entryPrice.toLocaleString("vi-VN")} nghìn ₫.` +
      (overLimit ? ` ${overLimit}` : ""),
  };
}

/**
 * Câu cảnh báo khi khối lượng vừa ghi vượt mức định cỡ cho phép — hoặc `null`
 * nếu nằm trong hạn mức, hoặc nếu không đủ dữ liệu để kết luận.
 *
 * Không đủ dữ liệu ⇒ IM LẶNG, không đoán: một cảnh báo dựng trên vốn tài khoản
 * chưa đặt hay ADV không đọc được cũng là một con số bịa.
 */
async function describeManualSizeOverrun(params: {
  userId: string;
  symbolId: string;
  entryKVnd: number;
  stopKVnd: number;
  quantity: number;
}): Promise<string | null> {
  try {
    const [{ equityVnd, sizingConfig, currentPortfolioExposureVnd }, adv] = await Promise.all([
      loadPositionSizingInputs(params.userId),
      loadSymbolAdvVnd(prisma, params.symbolId, new Date()),
    ]);
    if (equityVnd == null || !Number.isFinite(equityVnd) || equityVnd <= 0) return null;
    // ADV hỏng ⇒ im lặng: một cảnh báo "vượt hạn mức" tính thiếu trần thanh
    // khoản là một cảnh báo sai, tệ hơn là không cảnh báo.
    if (!adv.ok) return null;
    const advVnd = adv.value;

    // Trừ lại chính lệnh vừa ghi: nếu không, nó tự chiếm hạn mức của chính nó.
    const exposureBefore = Math.max(
      0,
      currentPortfolioExposureVnd - params.entryKVnd * 1000 * params.quantity
    );

    const sizing = computePositionSizing({
      accountEquityVnd: equityVnd,
      maxPortfolioExposurePct: DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT,
      currentPortfolioExposureVnd: exposureBefore,
      maxPerTradeExposurePct: sizingConfig.maxPositionPct ?? DEFAULT_MAX_PER_TRADE_PCT,
      baseRiskPerTradePct: sizingConfig.riskPerTradePct ?? DEFAULT_BASE_RISK_PER_TRADE_PCT,
      quality: "B",
      entryKVnd: params.entryKVnd,
      stopKVnd: params.stopKVnd,
      liquidityCapPct: sizingConfig.liquidityCapPct ?? DEFAULT_LIQUIDITY_CAP_PCT,
      symbolAvgDailyValueVnd: advVnd,
    });
    if (!sizing.ok) return null;

    const allowed = roundDownToBoardLotShares(sizing.value.qFinalShares);
    if (!allowed.ok || params.quantity <= allowed.quantity) return null;

    return (
      `Lưu ý: khối lượng này vượt mức định cỡ cho phép (${allowed.quantity.toLocaleString("vi-VN")} cp` +
      (sizing.value.liquidityCapBinding ? ", trần thanh khoản đang chặn" : "") +
      "). Lệnh vẫn được ghi vì đây là lệnh đã khớp ngoài hệ thống — nhưng vị thế nằm ngoài chính sách rủi ro."
    );
  } catch (e) {
    console.error("[trades] manual size overrun check failed:", e);
    return null;
  }
}

// ─── Update stop loss on an open position ───

const UpdateStopSchema = z.object({
  tradeId: z.string().min(1, "Thiếu lệnh."),
  stopLoss: z.coerce.number().positive("Giá cắt lỗ phải là số dương."),
});

/**
 * Dời cắt lỗ của một vị thế đang mở.
 *
 * Chỉ đổi đúng một trường; giá vào, khối lượng và chốt lời giữ nguyên. Cắt lỗ
 * phải thấp hơn giá vào — một "cắt lỗ" nằm trên giá vào không phải cắt lỗ mà là
 * lệnh chốt lời đặt nhầm ô, và ghi nó vào sẽ làm mọi phép tính R sai dấu.
 */
export async function updateTradeStopLoss(
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = UpdateStopSchema.safeParse({
    tradeId: formData.get("tradeId"),
    stopLoss: formData.get("stopLoss"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { tradeId, stopLoss } = parsed.data;

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: session.userId },
    select: { id: true, symbol: true, status: true, entryPrice: true },
  });
  if (!trade) return { message: "Không tìm thấy lệnh." };
  if (trade.status !== "OPEN") {
    return { message: "Chỉ dời được cắt lỗ của lệnh đang mở." };
  }
  if (stopLoss >= trade.entryPrice) {
    return {
      errors: {
        stopLoss: [
          `Cắt lỗ phải thấp hơn giá vào (${trade.entryPrice.toLocaleString("vi-VN")} nghìn ₫).`,
        ],
      },
    };
  }

  await prisma.trade.update({ where: { id: trade.id }, data: { stopLoss } });

  revalidatePath("/book");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: `Đã cập nhật cắt lỗ ${trade.symbol} → ${stopLoss.toLocaleString("vi-VN")} nghìn ₫.`,
  };
}

// ─── Post-trade note on a closed trade ───

const ExitNoteSchema = z.object({
  tradeId: z.string().min(1, "Thiếu lệnh."),
  exitNote: z.string().max(2000, "Ghi chú quá dài.").default(""),
});

/** Ghi chú sau lệnh cho một lệnh đã đóng — chỉ sửa phần rút kinh nghiệm. */
export async function updateTradeExitNote(
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const session = await getSession();
  if (!session) {
    return { message: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại." };
  }

  const parsed = ExitNoteSchema.safeParse({
    tradeId: formData.get("tradeId"),
    exitNote: formData.get("exitNote") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }
  const { tradeId, exitNote } = parsed.data;

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: session.userId },
    select: { id: true, symbol: true, status: true },
  });
  if (!trade) return { message: "Không tìm thấy lệnh." };
  if (trade.status !== "CLOSED") {
    return { message: "Chỉ ghi được ghi chú sau lệnh cho lệnh đã đóng." };
  }

  await prisma.trade.update({ where: { id: trade.id }, data: { exitNote } });
  revalidatePath("/book");

  return { success: true, message: `Đã lưu ghi chú sau lệnh ${trade.symbol}.` };
}
