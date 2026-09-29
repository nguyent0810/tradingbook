/**
 * What the order-ticket modal pre-fills (#17, #11 story 26): the numbers of the
 * SAME Gợi ý lệnh F1/F2/F7 show, never a second computation. Entry = the top of
 * the entry zone (the worst fill R is measured from), stop = the bottom of the
 * stop zone, a chosen R target (2R by default) and the reference size. Every
 * field stays editable on the ticket; the server checks the result on its own.
 *
 * Pure. Prices kVND, money VND.
 */
import type { Exchange } from "@/lib/market/exchange-rules";
import {
  DEFAULT_TARGET_R,
  type TargetR,
  type TradeSuggestionResult,
  type TradeSuggestionSizingInput,
} from "./trade-suggestion";
import { SIZING_UNAVAILABLE_COPY, suggestionUnavailableText } from "@/lib/terminal/trade-suggestion-display";
import type { SizingUnavailable } from "./screen-trade-suggestions";
import { logTradeShareCeiling, type LogTradeCeiling, type LogTradeCeilingInput } from "./reference-size";

/**
 * Everything the server's ceiling needs except the two numbers the user edits.
 * The ticket carries it so it can show the ceiling live, with the rule and the
 * inputs `createTradeFromSetup` uses, before anything is sent.
 */
export type TicketCeilingContext = Omit<LogTradeCeilingInput, "entryKvnd" | "stopKvnd">;

/** The server's share ceiling at the entry and stop on the ticket. */
export function ticketShareCeiling(
  ctx: TicketCeilingContext,
  entryKvnd: number,
  stopKvnd: number
): LogTradeCeiling {
  return logTradeShareCeiling({ ...ctx, entryKvnd, stopKvnd });
}

export type OrderTicketPrefill = {
  /** YYYY-MM-DD of the close the suggestion was built from. */
  asOfSession: string;
  exchange: Exchange;
  entryZone: { low: number; high: number };
  /** Pre-filled entry, kVND: the top of the entry zone. */
  entryKvnd: number;
  stopZone: { low: number; high: number };
  /** Pre-filled stop, kVND: the bottom of the stop zone. */
  stopKvnd: number;
  /** Mốc chốt 1R/2R/3R, kVND. */
  targets: { r: TargetR; priceKvnd: number }[];
  defaultTargetR: TargetR;
  /**
   * Size tham khảo; null when the suggestion carries no size OR the server
   * would refuse to log at the pre-filled numbers (no verdict, NO-TRADE, under
   * one lot): the ticket never pre-fills a size the server refuses.
   */
  shares: number | null;
  /** The lot-rounded size before the session verdict; null without a size. */
  sharesBeforeVerdict: number | null;
  /** Why there is no size; null otherwise. */
  sizeNote: string | null;
  /** Rủi ro lệnh at the pre-filled numbers (net R + Đệm gap), VND; null without a size. */
  worstCaseLossVnd: number | null;
  /** Inputs of the server's ceiling; null when the sizing inputs could not be read. */
  ceiling: TicketCeilingContext | null;
  evidence: { prospectiveN: number | null; checkpointN: number };
};

export type OrderTicketPrefillResult =
  | { ok: true; ticket: OrderTicketPrefill }
  | { ok: false; message: string };

export type OrderTicketPrefillInput = {
  result: TradeSuggestionResult | undefined;
  sizingUnavailable: SizingUnavailable | null;
  /** The sizing inputs the suggestion was built from; null when unavailable. */
  sizing: TradeSuggestionSizingInput | null;
  /** 20-session average traded value at the setup session, VND. */
  advVnd: number | null;
  tier: "A" | "B";
  /** Why the session verdict could not be built, when it could not. */
  verdictBlockedReason: string | null;
};

export function buildOrderTicketPrefill(input: OrderTicketPrefillInput): OrderTicketPrefillResult {
  const { result, sizing } = input;
  if (!result) {
    return {
      ok: false,
      message: suggestionUnavailableText("không nạp được nến hoặc sàn của mã để dựng gợi ý lệnh."),
    };
  }
  if (!result.ok) return { ok: false, message: suggestionUnavailableText(result.detail) };
  const s = result.suggestion;

  const ceiling: TicketCeilingContext | null = sizing
    ? {
        equityVnd: sizing.equityVnd,
        riskPerTradePct: sizing.riskPerTradePct,
        maxPerTradeExposurePct: sizing.maxPerTradeExposurePct,
        maxPortfolioExposurePct: sizing.maxPortfolioExposurePct,
        liquidityCapPct: sizing.liquidityCapPct,
        currentExposureVnd: sizing.currentExposureVnd,
        tier: input.tier,
        exchange: s.exchange,
        advVnd: input.advVnd,
        verdictLevel: sizing.verdictLevel,
        verdictBlockedReason: input.verdictBlockedReason,
      }
    : null;

  // Fail closed like the server: where it would refuse at the pre-filled
  // numbers, the ticket shows no size and the server's own reason.
  const atPrefill = ceiling ? ticketShareCeiling(ceiling, s.entryZone.high, s.stopZone.low) : null;
  const size = s.size && atPrefill?.ok ? s.size : null;
  const sizeNote = size
    ? null
    : atPrefill && !atPrefill.ok
      ? atPrefill.message
      : (s.size?.zeroShareReason ?? SIZING_UNAVAILABLE_COPY[input.sizingUnavailable ?? "NO_EQUITY"]);

  return {
    ok: true,
    ticket: {
      asOfSession: s.asOfSession,
      exchange: s.exchange,
      entryZone: { ...s.entryZone },
      entryKvnd: s.entryZone.high,
      stopZone: { low: s.stopZone.low, high: s.stopZone.high },
      stopKvnd: s.stopZone.low,
      targets: s.targets.map((t) => ({ r: t.r, priceKvnd: t.price })),
      defaultTargetR: DEFAULT_TARGET_R,
      shares: size ? size.shares : null,
      sharesBeforeVerdict: size ? size.sharesBeforeVerdict : null,
      sizeNote,
      worstCaseLossVnd: size ? size.worstCaseLossVnd : null,
      ceiling,
      evidence: { prospectiveN: s.evidence.prospectiveN, checkpointN: s.evidence.checkpointN },
    },
  };
}
