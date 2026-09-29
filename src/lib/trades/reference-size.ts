/**
 * The share count a Gợi ý lệnh is sized to, and the ceiling the server applies
 * when a trade is logged from one (#17). Both run `referenceShares`, so the
 * suggestion F2 shows and the server's own cap are the same number whenever
 * their inputs are the same: a suggestion-sized order is never refused in the
 * normal case. The server still reads every input itself (it never takes the
 * size from the ticket), so the check stays independent.
 *
 * Pure. Prices kVND, money VND, percentages decimal fractions (0.01 = 1%).
 */
import {
  computePositionSizing,
  type PositionSizingComputed,
  type PositionSizingErrorCode,
} from "@/lib/position-sizing";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import { applyVerdictToShares } from "@/lib/terminal/verdict-tokens";
import { roundDownToLot, type Exchange } from "@/lib/market/exchange-rules";
import { worstCaseRiskPerShare, type WorstCaseRiskPerShare } from "./worst-case-risk";

export type ReferenceSharesInput = {
  equityVnd: number;
  /** Before the tier multiplier. */
  riskPerTradePct: number;
  maxPerTradeExposurePct: number;
  maxPortfolioExposurePct: number;
  liquidityCapPct: number;
  /** Sum of entry × quantity of open trades, VND. */
  currentExposureVnd: number;
  /** Anything but A is sized like B (half risk), never at full risk. */
  tier: "A" | "B" | null;
  exchange: Exchange;
  entryKvnd: number;
  stopKvnd: number;
  /** 20-session average traded value, VND; null = no liquidity cap. */
  advVnd: number | null;
  verdictLevel: VerdictUxLevel | null;
};

export type ReferenceShares = {
  sized: PositionSizingComputed;
  worstCase: WorstCaseRiskPerShare;
  quality: "A" | "B";
  /** Lot-rounded, before the session verdict. */
  sharesBeforeVerdict: number;
  /** After the session verdict; equals `sharesBeforeVerdict` without one. */
  shares: number;
  verdict: ReturnType<typeof applyVerdictToShares> | null;
};

/**
 * Risk budget ÷ worst case per share (net R + Đệm gap), then the exposure and
 * liquidity caps, then the 100-share lot, then the session verdict.
 */
export function referenceShares(
  p: ReferenceSharesInput
): { ok: true; value: ReferenceShares } | { ok: false; code: PositionSizingErrorCode } {
  const worstCase = worstCaseRiskPerShare({
    entryKvnd: p.entryKvnd,
    stopKvnd: p.stopKvnd,
    exchange: p.exchange,
  });
  const quality = p.tier === "A" ? "A" : "B";
  const sized = computePositionSizing({
    accountEquityVnd: p.equityVnd,
    maxPortfolioExposurePct: p.maxPortfolioExposurePct,
    currentPortfolioExposureVnd: p.currentExposureVnd,
    maxPerTradeExposurePct: p.maxPerTradeExposurePct,
    baseRiskPerTradePct: p.riskPerTradePct,
    quality,
    entryKVnd: p.entryKvnd,
    stopKVnd: p.stopKvnd,
    liquidityCapPct: p.liquidityCapPct,
    symbolAvgDailyValueVnd: p.advVnd,
    perShareRiskVnd: worstCase.worstCasePerShareKvnd * 1000,
  });
  if (!sized.ok) return sized;
  const sharesBeforeVerdict = roundDownToLot(sized.value.qFinalShares);
  const verdict = p.verdictLevel ? applyVerdictToShares(sharesBeforeVerdict, p.verdictLevel) : null;
  return {
    ok: true,
    value: {
      sized: sized.value,
      worstCase,
      quality,
      sharesBeforeVerdict,
      shares: verdict ? verdict.shares : sharesBeforeVerdict,
      verdict,
    },
  };
}

export type LogTradeCeilingInput = Omit<ReferenceSharesInput, "equityVnd"> & {
  /** Null when no equity is on record. */
  equityVnd: number | null;
  /** Why the verdict could not be built, shown when `verdictLevel` is null. */
  verdictBlockedReason: string | null;
};

export type LogTradeCeiling =
  | { ok: true; shares: number; sharesBeforeVerdict: number; verdictCode: string }
  | { ok: false; message: string };

const fmtShares = (n: number) => n.toLocaleString("vi-VN");

/**
 * The most shares the server records for a trade logged from a setup, at the
 * entry and stop the user confirmed. Refuses, with the reason, where the
 * suggestion carries no size: no equity, no verdict, NO-TRADE, under one lot.
 */
export function logTradeShareCeiling(p: LogTradeCeilingInput): LogTradeCeiling {
  if (p.equityVnd == null || !Number.isFinite(p.equityVnd) || p.equityVnd <= 0) {
    return {
      ok: false,
      message:
        "Chưa đặt vốn tài khoản trong Cài đặt (F5) — không tính được khối lượng lệnh. Đặt vốn rồi ghi lại.",
    };
  }
  if (p.verdictLevel == null) {
    return {
      ok: false,
      message: `Chưa dựng được phán quyết phiên nên không ghi lệnh mới. ${p.verdictBlockedReason ?? ""}`.trim(),
    };
  }
  if (p.verdictLevel === "NO_TRADE") {
    return {
      ok: false,
      message:
        "Phán quyết phiên là NO-TRADE — hệ thống không ghi lệnh mới từ thiết lập. Nếu đã khớp ngoài hệ thống, dùng Ghi lệnh tay ở Sổ lệnh (F4).",
    };
  }
  if (!(p.entryKvnd > p.stopKvnd)) {
    return { ok: false, message: "Giá vào lệnh phải cao hơn giá cắt lỗ." };
  }
  const ref = referenceShares({ ...p, equityVnd: p.equityVnd });
  if (!ref.ok) {
    return {
      ok: false,
      message:
        ref.code === "ZERO_EQUITY"
          ? "Vốn tài khoản chưa hợp lệ — kiểm tra lại trong Cài đặt."
          : "Không thể tính khối lượng lệnh hợp lệ từ giá vào và cắt lỗ này.",
    };
  }
  const { shares, sharesBeforeVerdict, verdict } = ref.value;
  if (sharesBeforeVerdict <= 0) {
    return {
      ok: false,
      message: "Khối lượng tính được dưới 1 lô (100 cổ phiếu) — dư địa rủi ro/tỷ trọng hiện không đủ.",
    };
  }
  const verdictCode = verdict?.tokens.code ?? p.verdictLevel;
  if (shares <= 0) {
    return {
      ok: false,
      message: `Phán quyết ${verdictCode} đưa khối lượng tham khảo về 0 — không ghi lệnh mới từ thiết lập.`,
    };
  }
  return { ok: true, shares, sharesBeforeVerdict, verdictCode };
}

/**
 * The quantity the server records: the user's figure rounded down to the lot,
 * never above the ceiling; the ceiling itself when the user left it blank.
 */
export function checkConfirmedQuantity(
  ceiling: Extract<LogTradeCeiling, { ok: true }>,
  confirmedQuantity: number | null
): { ok: true; quantity: number } | { ok: false; message: string } {
  if (confirmedQuantity == null) return { ok: true, quantity: ceiling.shares };
  if (confirmedQuantity > ceiling.shares) {
    return {
      ok: false,
      message:
        `Khối lượng vượt trần ${fmtShares(ceiling.shares)} cp (rủi ro xấu nhất có đệm gap, phán quyết ${ceiling.verdictCode}) tại giá vào và cắt lỗ này. ` +
        "Nếu đã khớp nhiều hơn ngoài hệ thống, dùng Ghi lệnh tay ở Sổ lệnh (F4).",
    };
  }
  const quantity = roundDownToLot(confirmedQuantity);
  if (quantity <= 0) return { ok: false, message: "Khối lượng dưới 1 lô (100 cổ phiếu)." };
  return { ok: true, quantity };
}
