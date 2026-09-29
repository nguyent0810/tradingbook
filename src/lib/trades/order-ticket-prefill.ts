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
import type { TradeSuggestionResult } from "./trade-suggestion";
import { SIZING_UNAVAILABLE_COPY, type SizingUnavailable } from "./screen-trade-suggestions";

export type TargetR = 1 | 2 | 3;

export const DEFAULT_TARGET_R: TargetR = 2;

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
  /** Size tham khảo; null when the suggestion carries no size. */
  shares: number | null;
  /** The lot-rounded size before the session verdict; null without a size. */
  sharesBeforeVerdict: number | null;
  /** Why there is no size, or why it is 0 cp; null otherwise. */
  sizeNote: string | null;
  /** Rủi ro lệnh at the pre-filled numbers (net R + Đệm gap), VND; null without a size. */
  worstCaseLossVnd: number | null;
  evidence: { prospectiveN: number | null; checkpointN: number };
};

export type OrderTicketPrefillResult =
  | { ok: true; ticket: OrderTicketPrefill }
  | { ok: false; message: string };

export function buildOrderTicketPrefill(
  result: TradeSuggestionResult | undefined,
  sizingUnavailable: SizingUnavailable | null
): OrderTicketPrefillResult {
  if (!result) {
    return { ok: false, message: "Không đủ dữ liệu — không nạp được nến hoặc sàn của mã để dựng gợi ý lệnh." };
  }
  if (!result.ok) return { ok: false, message: `Không đủ dữ liệu — ${result.detail}` };
  const s = result.suggestion;
  const size = s.size;
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
      sizeNote: size
        ? size.zeroShareReason
        : SIZING_UNAVAILABLE_COPY[sizingUnavailable ?? "NO_EQUITY"],
      worstCaseLossVnd: size ? size.worstCaseLossVnd : null,
      evidence: { prospectiveN: s.evidence.prospectiveN, checkpointN: s.evidence.checkpointN },
    },
  };
}
