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
import type { Gate1Level, Gate2BarInput } from "@/lib/scanner/gate2/types";
import { fmtNum, fmtSessionDate, fmtVndCompact } from "@/lib/format/vn";
import { barsThroughSession, utcDayKey } from "@/lib/scanner/early-entry/bar-metrics";
import { sortDedupeGate2Bars } from "@/lib/scanner/gate2/breakout-pullback";
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
import {
  ADV_ADJUSTED_PRICE_CAVEAT,
  BANNED_IMPERATIVE_PATTERNS,
  RISK_CODES,
  RISK_COPY,
  SETTLEMENT_BREACH_COPY,
  SETUP_REASON_CODES,
  SETUP_REASON_COPY,
  SETUP_REASON_PATTERNS,
  UNMAPPED_REASON_COPY,
  UNMAPPED_REASON_GENERIC_COPY,
  type RiskCode,
  type RiskSeverity,
  type SetupReasonCode,
} from "./trade-suggestion-copy";

/** 0.1% transfer tax on every sale. */
const SELL_TAX_FRAC = 0.001;
/**
 * Brokerage per side. `ROUND_TRIP_FEE_FRAC` is two sides of brokerage plus the
 * sell tax (see its doc), so one side is what remains halved: 0.15%.
 */
const BROKERAGE_PER_SIDE_FRAC = (ROUND_TRIP_FEE_FRAC - SELL_TAX_FRAC) / 2;

/** First validation checkpoint of ADR 0001 / PROSPECTIVE-REGISTRY-PLAN.md. */
export const CHECKPOINT_N = 100;

const R_MULTIPLES = [1, 2, 3] as const;

/**
 * Kịch bản sàn liên tiếp: sessions at the floor in a row. Three covers the
 * T+2.5 lockup (the session after the fill, the one after that, and the
 * morning before the shares arrive) plus the first session they can be sold.
 */
export const LIMIT_DOWN_RUN_SESSIONS = 3;

/** Floor sessions that can pass before bought shares arrive (T+2.5). */
const SETTLEMENT_FLOOR_SESSIONS = 2;

/**
 * Below this 20-session average traded value the liquidity risk fires. Five
 * times the scanner's tradability floor (2 tỷ): a symbol can pass tradability
 * and still be thin for exiting on a bad day.
 */
export const LIQUIDITY_THIN_ADV_VND = 10_000_000_000;

/** Share of the 20-session average the liquidity risk expresses in 100-share lots. */
const LIQUIDITY_REFERENCE_FRAC = 0.01;

const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, warn: 1, info: 2 };

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
  /**
   * YYYY-MM-DD of the latest session in the bars: its close is the reference
   * of the next-session band the entry zone is clipped to.
   */
  asOfSession: string;
  /** YYYY-MM-DD of the scan session the setup's structure comes from. */
  setupSession: string;
  /** Sessions between the setup and `asOfSession`; > 0 means the setup is older than the data. */
  sessionsSinceSetup: number;
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
  /**
   * The scanner's reasons in plain Vietnamese, in the scanner's order. `code`
   * is a `SetupReasonCode`, or "unmapped" for a line no code recognises (the
   * raw line is then kept in the text rather than dropped).
   */
  reasons: { code: SetupReasonCode | "unmapped"; text: string }[];
  /**
   * Risks, ordered high → warn → info, and within a severity by `RISK_CODES`.
   * Copy is descriptive (ADR 0003).
   */
  risks: { code: RiskCode; severity: RiskSeverity; text: string }[];
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
    /** `SetupCandidate.quality`; null when it is neither A nor B (no tier risk is raised). */
    tier: "A" | "B" | null;
    /** `SetupCandidate.reasons` lines as the classifier wrote them. */
    reasons: readonly string[];
  };
  /**
   * Daily bars of the symbol, any order, through the LATEST stored session.
   * Structure (zone, stop, ATR, resistance) uses bars through the setup
   * session; the next-session band uses the latest close.
   */
  bars: readonly Gate2BarInput[];
  /** `StockSymbol.exchange` as stored; unknown values assume HOSE. */
  exchange: string | null;
  /** Eligible prospective observations so far; null when unknown. */
  prospectiveN: number | null;
  /** Live Gate 1 market regime; null when it could not be evaluated. */
  gate1Level: Gate1Level | null;
  /**
   * The session the market is on (the index's latest session). Stale data is a
   * latest stock bar older than this; null when unknown (no stale check).
   */
  expectedSession: Date | null;
  /**
   * 20-session average traded value in VND at the setup session, the same
   * figure F2 sizes with (`symbol-adv`: close × 1000 × volMa20); null when
   * there is none.
   */
  advVnd: number | null;
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

/** kVND price with two decimals, as F2 prints prices. */
const price = (kvnd: number) => fmtNum(kvnd, 2);

/**
 * Floor of the session after one whose reference is `refKvnd`; null when the
 * reference has no quotable floor (a price of one tick).
 */
function nextFloor(refKvnd: number, exchange: Exchange): number | null {
  try {
    return sessionBand(refKvnd, exchange).floor;
  } catch (e) {
    if (e instanceof RangeError) return null;
    throw e;
  }
}

/** Re-print a number captured from an English line in vi-VN, keeping its decimals. */
function viNumber(raw: string): string {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  const decimals = raw.includes(".") ? raw.length - raw.indexOf(".") - 1 : 0;
  return n.toLocaleString("vi-VN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/**
 * The scanner's stored reason lines in plain Vietnamese, in the scanner's order.
 * Exported for screens that list a setup's reasons without a suggestion (F2's
 * Cổng 2 criteria), so every screen shows the same copy.
 */
export function describeSetupReasons(lines: readonly string[]): TradeSuggestion["reasons"] {
  return lines.filter((l) => l.trim() !== "").map(describeReason);
}

function describeReason(line: string): TradeSuggestion["reasons"][number] {
  for (const code of SETUP_REASON_CODES) {
    const { pattern, groups } = SETUP_REASON_PATTERNS[code];
    const match = pattern.exec(line.trim());
    if (!match) continue;
    const values: Record<string, string> = {};
    groups.forEach((key, i) => {
      const raw = match[i + 1];
      if (raw != null) values[key] = viNumber(raw);
    });
    return { code, text: fill(SETUP_REASON_COPY[code], values) };
  }
  const raw = line.trim();
  const echoable = !BANNED_IMPERATIVE_PATTERNS.some((p) => p.test(raw));
  return {
    code: "unmapped",
    text: echoable ? fill(UNMAPPED_REASON_COPY, { raw }) : UNMAPPED_REASON_GENERIC_COPY,
  };
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
  const allBars = sortDedupeGate2Bars(input.bars);
  const latestBar = allBars[allBars.length - 1]!;
  const { exchange, assumed } = resolveExchange(input.exchange);

  // The next session's reference is the MOST RECENT close (sessionBand's
  // contract): it is the raw traded price, whereas an older stored close may be
  // back-adjusted, and a band built from it would belong to a session that has
  // already passed.
  let band: SessionBand;
  try {
    band = sessionBand(latestBar.close, exchange);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    return fail(
      "NO_REFERENCE_PRICE",
      `giá đóng cửa ${fmt(latestBar.close)} không cho ra biên độ phiên kế tiếp trên ${exchange}`
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

  // Targets per #11 story 9: the gain after costs equals k × net R, rounded up.
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

  const asOfSession = utcDayKey(latestBar.date);
  const setupSession = utcDayKey(lastBar.date);
  const sessionsSinceSetup = allBars.length - 1 - idx;

  const risks: TradeSuggestion["risks"] = [];
  const raise = (code: RiskCode, severity: RiskSeverity, values: Record<string, string> = {}) =>
    risks.push({ code, severity, text: fill(RISK_COPY[code], values) });

  if (input.gate1Level === "FAIL") raise("regime_fail", "high");
  else if (input.gate1Level === "WARNING") raise("regime_warning", "warn");
  else if (input.gate1Level == null) raise("regime_unknown", "warn");

  if (input.expectedSession && asOfSession < utcDayKey(input.expectedSession)) {
    raise("stale_data", "warn", {
      asOf: fmtSessionDate(asOfSession),
      expected: fmtSessionDate(utcDayKey(input.expectedSession)),
    });
  }
  if (sessionsSinceSetup > 0) {
    raise("stale_setup", "warn", {
      setupSession: fmtSessionDate(setupSession),
      sessions: String(sessionsSinceSetup),
    });
  }

  // Floor path from the worst fill: the price after k limit-down sessions in a
  // row, each band taken from the previous floor (the exchange's reference).
  const floors: number[] = [];
  for (let k = 0, ref = entryTop; k < LIMIT_DOWN_RUN_SESSIONS; k++) {
    const floor = nextFloor(ref, exchange);
    if (floor == null) break;
    floors.push(floor);
    ref = floor;
  }
  const inR = (loss: number) => fmtNum(loss / perShareGross, 2);
  const oneFloor = floors[0];
  if (oneFloor != null && oneFloor < stopZone.low) {
    const loss = roundVnd(entryTop - oneFloor);
    raise("gap_through_stop", "high", {
      bandPct: String(band.bandPct),
      entryTop: price(entryTop),
      floor: price(oneFloor),
      stop: price(stopZone.low),
      loss: price(loss),
      lossR: inR(loss),
    });
  }
  const runFloor = floors[LIMIT_DOWN_RUN_SESSIONS - 1];
  if (runFloor != null && runFloor < stopZone.low) {
    const loss = roundVnd(entryTop - runFloor);
    raise("limit_down_run", "warn", {
      n: String(LIMIT_DOWN_RUN_SESSIONS),
      entryTop: price(entryTop),
      price: price(runFloor),
      loss: price(loss),
      lossR: inR(loss),
    });
  }

  if (structural > minFeasible) {
    raise("stop_too_tight", "warn", {
      structural: price(structural),
      minFeasible: price(minFeasible),
      low: price(stopZone.low),
    });
  }

  const twoR = targets.find((t) => t.r === 2);
  if (twoR?.resistanceBelow && resistances.length > 0) {
    // `resistances` is ascending, so the first is the first one price meets.
    raise("resistance_below_2r", "warn", {
      resistance: price(resistances[0]!),
      target: price(twoR.price),
    });
  }

  if (input.advVnd == null || !Number.isFinite(input.advVnd) || input.advVnd <= 0) {
    raise("liquidity_unknown", "warn");
  } else if (input.advVnd < LIQUIDITY_THIN_ADV_VND) {
    const lotVnd = entryTop * 1000 * 100;
    const lots = Math.floor((input.advVnd * LIQUIDITY_REFERENCE_FRAC) / lotVnd);
    raise("liquidity_thin", "warn", {
      adv: fmtVndCompact(input.advVnd),
      threshold: fmtVndCompact(LIQUIDITY_THIN_ADV_VND),
      lots: lots >= 1 ? `khoảng ${fmtNum(lots, 0)} lô` : "chưa tới 1 lô",
      entryTop: price(entryTop),
      caveat: ADV_ADJUSTED_PRICE_CAVEAT,
    });
  }

  if (assumed) raise("exchange_assumed", "warn");

  // T+2.5 always applies to a buy (#11 story 14). It is a warning when the floor
  // path can cross the stop before the shares arrive.
  const settlementFloor = floors[SETTLEMENT_FLOOR_SESSIONS - 1];
  if (settlementFloor != null && settlementFloor < stopZone.low) {
    risks.push({
      code: "settlement_lockup",
      severity: "warn",
      text: `${RISK_COPY.settlement_lockup} ${fill(SETTLEMENT_BREACH_COPY, {
        entryTop: price(entryTop),
        price: price(settlementFloor),
      })}`,
    });
  } else {
    raise("settlement_lockup", "info");
  }

  if (setup.tier === "B") raise("tier_b", "info");

  risks.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      RISK_CODES.indexOf(a.code) - RISK_CODES.indexOf(b.code)
  );

  return {
    ok: true,
    suggestion: {
      asOfSession,
      setupSession,
      sessionsSinceSetup,
      exchange,
      exchangeAssumed: assumed,
      entryZone,
      stopZone,
      r: { perShareGross, perShareNet },
      targets,
      size: null,
      reasons: describeSetupReasons(setup.reasons),
      risks,
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
