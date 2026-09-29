/**
 * Gợi ý lệnh (trade suggestion) — see CONTEXT.md and issue #11.
 *
 * One pure module turns a qualified scanner setup plus its daily bars into the
 * numbers every screen shows: the Vùng vào (entry zone), the Vùng SL (stop
 * zone), worst-case R gross and net of costs, the 1R/2R/3R Mốc chốt with the
 * nearest resistance, the as-of session and the Trạng thái kiểm chứng. It has
 * no DB, clock or network access; callers pass everything in, including the
 * prospective count.
 *
 * The result is REFERENCE ONLY (ADR 0003): copy built on it must describe
 * ("vùng tham khảo"), never instruct.
 *
 * Prices are kVND. Every price goes through `market/exchange-rules`, so each
 * one is a valid quote on the symbol's exchange.
 */
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { barsThroughSession, utcDayKey } from "@/lib/scanner/early-entry/bar-metrics";
import { collectResistanceCandidates } from "@/lib/scanner/early-entry/risk-reward";
import {
  ROUND_TRIP_FEE_FRAC,
  computeAtr,
  computeMinStopFrac,
} from "@/lib/scanner/stop-feasibility";
import {
  clipToBand,
  resolveExchange,
  sessionBand,
  snapToTick,
  type Exchange,
  type SessionBand,
} from "@/lib/market/exchange-rules";
import { MIN_BARS_FOR_STRUCTURAL_SCAN, tightenEntryZone } from "./auto-populate-from-setup";

/** 0.1% transfer tax on every sale. */
const SELL_TAX_FRAC = 0.001;
/**
 * Brokerage per side. `ROUND_TRIP_FEE_FRAC` is two sides of brokerage plus the
 * sell tax (see its doc), so one side is what remains halved: 0.15%.
 */
const BROKERAGE_PER_SIDE_FRAC = (ROUND_TRIP_FEE_FRAC - SELL_TAX_FRAC) / 2;

/** First validation checkpoint of ADR 0001 / PROSPECTIVE-REGISTRY-PLAN.md. */
const CHECKPOINT_N = 100;

const R_MULTIPLES = [1, 2, 3] as const;

export type TradeSuggestionTarget = {
  r: 1 | 2 | 3;
  /** Price at which the gain NET of costs is r × net R, rounded up to the tick. */
  price: number;
  /** Resistance above the entry zone closest to `price`; null when none was found. */
  nearestResistance: number | null;
  /** True when some resistance sits between the entry zone and `price`. */
  resistanceBelow: boolean;
};

export type TradeSuggestion = {
  /** YYYY-MM-DD of the session whose close the suggestion is built from. */
  asOfSession: string;
  exchange: Exchange;
  /** No exchange on record: HOSE ticks and band were assumed. */
  exchangeAssumed: boolean;
  /** Tick-snapped, inside the next session's band. */
  entryZone: { low: number; high: number };
  /**
   * `structural`: the setup's own invalidation level. `minFeasible`: the
   * highest stop that clears tick, cost and one-day noise from every fill in
   * the entry zone. `low`/`high` are the lower/higher of the two; both snapped
   * DOWN to the tick so rounding never tightens a stop.
   */
  stopZone: { structural: number; minFeasible: number; low: number; high: number };
  /**
   * Worst case per share: top of the entry zone to the bottom of the stop zone.
   * `perShareNet` adds brokerage on both legs and the sell tax.
   */
  r: { perShareGross: number; perShareNet: number };
  targets: TradeSuggestionTarget[];
  /** Reference size — #15. Null until then. */
  size: {
    shares: number;
    bindingCap: string | null;
    worstCaseLossVnd: number;
    tradeRiskPct: number;
  } | null;
  /** Vietnamese reasons — #14. Empty until then. */
  reasons: { code: string; text: string }[];
  /** Risks — #14. Empty until then. */
  risks: { code: string; severity: "info" | "warn" | "high"; text: string }[];
  /**
   * Always UNVALIDATED before the ADR 0001 checkpoint. `prospectiveN` is null
   * when the registry could not be read ("N không rõ").
   */
  evidence: { status: "UNVALIDATED"; prospectiveN: number | null; checkpointN: number };
};

export type TradeSuggestionFailure =
  | "TOO_FEW_BARS"
  | "NO_SESSION_BAR"
  | "NO_REFERENCE_PRICE"
  | "DEGENERATE_ZONE"
  | "ZONE_OUTSIDE_BAND"
  | "STOP_NOT_BELOW_ENTRY";

export type TradeSuggestionResult =
  | { ok: true; suggestion: TradeSuggestion }
  | { ok: false; reason: TradeSuggestionFailure; /** Vietnamese, descriptive. */ detail: string };

export type TradeSuggestionInput = {
  /** The stored scanner setup (SetupCandidate). Prices in kVND. */
  setup: {
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    stopLevel: number;
    /** The scan session; bars after it are ignored. */
    barDate: Date;
  };
  /** Daily bars of the symbol, any order; must include the setup session. */
  bars: readonly Gate2BarInput[];
  /** `StockSymbol.exchange` as stored; unknown values assume HOSE. */
  exchange: string | null;
  /** Eligible prospective observations so far; null when unknown. */
  prospectiveN: number | null;
};

function fail(reason: TradeSuggestionFailure, detail: string): TradeSuggestionResult {
  return { ok: false, reason, detail };
}

function positive(x: number): boolean {
  return Number.isFinite(x) && x > 0;
}

/** kVND rounded to whole VND — sheds float noise from differences of quotes. */
function roundVnd(kvnd: number): number {
  return Math.round(kvnd * 1000) / 1000;
}

function fmt(kvnd: number): string {
  return kvnd.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export function buildTradeSuggestion(input: TradeSuggestionInput): TradeSuggestionResult {
  const { setup } = input;
  const through = barsThroughSession(input.bars, setup.barDate);
  if (!through) {
    return fail("NO_SESSION_BAR", `không có nến của phiên quét ${utcDayKey(setup.barDate)}`);
  }
  if (through.sorted.length < MIN_BARS_FOR_STRUCTURAL_SCAN) {
    return fail(
      "TOO_FEW_BARS",
      `mới có ${through.sorted.length} phiên giá, cần ít nhất ${MIN_BARS_FOR_STRUCTURAL_SCAN}`
    );
  }
  const { sorted, idx } = through;
  const lastBar = sorted[idx]!;
  const { exchange, assumed } = resolveExchange(input.exchange);

  // The as-of close is the most recent raw traded price, hence the next
  // session's reference (see sessionBand).
  let band: SessionBand;
  try {
    band = sessionBand(lastBar.close, exchange);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    return fail(
      "NO_REFERENCE_PRICE",
      `giá đóng cửa ${fmt(lastBar.close)} không cho ra biên độ phiên kế tiếp trên ${exchange}`
    );
  }

  if (!positive(setup.pullbackZoneLow) || !positive(setup.pullbackZoneHigh)) {
    return fail("DEGENERATE_ZONE", "vùng pullback đã lưu thiếu giá hợp lệ");
  }
  if (setup.pullbackZoneLow > setup.pullbackZoneHigh) {
    return fail(
      "DEGENERATE_ZONE",
      `vùng pullback ${fmt(setup.pullbackZoneLow)}–${fmt(setup.pullbackZoneHigh)} có đầu dưới cao hơn đầu trên`
    );
  }

  const tightened = tightenEntryZone(
    { low: setup.pullbackZoneLow, high: setup.pullbackZoneHigh },
    lastBar
  );
  const snappedLow = snapToTick(tightened.low, exchange, "nearest");
  const snappedHigh = snapToTick(tightened.high, exchange, "nearest");
  if (snappedLow > band.ceiling || snappedHigh < band.floor) {
    return fail(
      "ZONE_OUTSIDE_BAND",
      `vùng ${fmt(snappedLow)}–${fmt(snappedHigh)} nằm ngoài biên độ phiên kế tiếp ${fmt(
        band.floor
      )}–${fmt(band.ceiling)}`
    );
  }
  const entryZone = { low: clipToBand(snappedLow, band), high: clipToBand(snappedHigh, band) };

  const zoneText = `${fmt(entryZone.low)}–${fmt(entryZone.high)}`;
  if (!positive(setup.stopLevel)) {
    return fail("STOP_NOT_BELOW_ENTRY", `mức vô hiệu đã lưu không phải giá dương, vùng vào ${zoneText}`);
  }
  if (snapToTick(setup.stopLevel, exchange, "down") >= entryZone.low) {
    return fail(
      "STOP_NOT_BELOW_ENTRY",
      `mức vô hiệu ${fmt(setup.stopLevel)} không nằm dưới vùng vào ${zoneText}`
    );
  }
  const structural = snapToTick(setup.stopLevel, exchange, "down");

  // Minimum feasible stop from the LOWEST fill: a stop that clears noise from
  // there clears it from every fill in the zone.
  const atr = computeAtr(sorted, 14);
  const { minStopFrac } = computeMinStopFrac({ entryPrice: entryZone.low, atr, board: exchange });
  const minFeasible = snapToTick(entryZone.low * (1 - minStopFrac), exchange, "down");
  const stopZone = {
    structural,
    minFeasible,
    low: Math.min(structural, minFeasible),
    high: Math.max(structural, minFeasible),
  };

  const entryTop = entryZone.high;
  const perShareGross = roundVnd(entryTop - stopZone.low);
  // Costs are fractions of a VND per share; they are kept, not rounded, so the
  // targets below are solved against the exact figure.
  const perShareNet =
    perShareGross +
    entryTop * BROKERAGE_PER_SIDE_FRAC +
    stopZone.low * (BROKERAGE_PER_SIDE_FRAC + SELL_TAX_FRAC);

  const resistances = [
    ...new Set(
      collectResistanceCandidates(sorted, idx, lastBar.close).map((c) =>
        snapToTick(c.level, exchange, "nearest")
      )
    ),
  ]
    .filter((level) => level > entryTop)
    .sort((a, b) => a - b);

  // Net gain at P = P(1 − sell costs) − entryTop(1 + buy brokerage) = k × net R.
  const buyCost = entryTop * (1 + BROKERAGE_PER_SIDE_FRAC);
  const sellKeep = 1 - BROKERAGE_PER_SIDE_FRAC - SELL_TAX_FRAC;
  const targets = R_MULTIPLES.map((r): TradeSuggestionTarget => {
    const price = snapToTick((buyCost + r * perShareNet) / sellKeep, exchange, "up");
    let nearestResistance: number | null = null;
    for (const level of resistances) {
      if (nearestResistance == null || Math.abs(level - price) < Math.abs(nearestResistance - price)) {
        nearestResistance = level;
      }
    }
    return { r, price, nearestResistance, resistanceBelow: resistances.some((l) => l < price) };
  });

  return {
    ok: true,
    suggestion: {
      asOfSession: utcDayKey(lastBar.date),
      exchange,
      exchangeAssumed: assumed,
      entryZone,
      stopZone,
      r: { perShareGross, perShareNet },
      targets,
      size: null,
      reasons: [],
      risks: [],
      evidence: {
        status: "UNVALIDATED",
        prospectiveN:
          input.prospectiveN != null && Number.isInteger(input.prospectiveN) && input.prospectiveN >= 0
            ? input.prospectiveN
            : null,
        checkpointN: CHECKPOINT_N,
      },
    },
  };
}
