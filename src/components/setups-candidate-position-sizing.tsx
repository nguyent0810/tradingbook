"use client";

import { memo, useMemo, useState } from "react";
import { formatVND } from "@/lib/formatters";
import {
  computePositionSizing,
  type PositionSizingQuality,
} from "@/lib/position-sizing";

function parseMoney(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : Number.NaN;
}

function parsePctToFrac(raw: string): number {
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n)) return Number.NaN;
  return n / 100;
}

/** Percent string from a decimal fraction (0.15 -> "15"), or a fallback when the value is unset. */
function pctStringFromFrac(frac: number | null | undefined, fallback: string): string {
  return frac != null ? String(Math.round(frac * 100)) : fallback;
}

type Props = {
  symbolKey: string;
  quality: PositionSizingQuality;
  defaultEntryKVnd: number;
  defaultStopKVnd: number;
  /** Prefilled from the user's Settings (decimal fraction) — still editable here for what-if sizing. */
  initialEquityVnd: number | null;
  initialBaseRiskPct: number | null;
  initialMaxTradePct: number | null;
  initialLiquidityCapPct: number | null;
  /** 20-session average daily traded value (VND) for the liquidity-cap constraint. */
  symbolAvgDailyValueVnd: number | null;
};

export const SetupsCandidatePositionSizing = memo(function SetupsCandidatePositionSizing({
  symbolKey,
  quality,
  defaultEntryKVnd,
  defaultStopKVnd,
  initialEquityVnd,
  initialBaseRiskPct,
  initialMaxTradePct,
  initialLiquidityCapPct,
  symbolAvgDailyValueVnd,
}: Props) {
  const [equity, setEquity] = useState(() => (initialEquityVnd != null ? String(initialEquityVnd) : "500000000"));
  const [maxPortPct, setMaxPortPct] = useState("70");
  const [currentExp, setCurrentExp] = useState("0");
  const [maxTradePct, setMaxTradePct] = useState(() => pctStringFromFrac(initialMaxTradePct, "20"));
  const [baseRiskPct, setBaseRiskPct] = useState(() => pctStringFromFrac(initialBaseRiskPct, "1"));
  const [liquidityCapPct, setLiquidityCapPct] = useState(() => pctStringFromFrac(initialLiquidityCapPct, "10"));
  const [entryK, setEntryK] = useState(String(defaultEntryKVnd));
  const [stopK, setStopK] = useState(String(defaultStopKVnd));

  const computed = useMemo(() => {
    const accountEquityVnd = parseMoney(equity);
    const maxPortfolioExposurePct = parsePctToFrac(maxPortPct);
    const currentPortfolioExposureVnd = parseMoney(currentExp);
    const maxPerTradeExposurePct = parsePctToFrac(maxTradePct);
    const baseRiskPerTradePct = parsePctToFrac(baseRiskPct);
    const liquidityCapFrac = parsePctToFrac(liquidityCapPct);
    const entryKVnd = Number.parseFloat(entryK);
    const stopKVnd = Number.parseFloat(stopK);

    return computePositionSizing({
      accountEquityVnd,
      maxPortfolioExposurePct,
      currentPortfolioExposureVnd,
      maxPerTradeExposurePct,
      baseRiskPerTradePct,
      quality,
      entryKVnd,
      stopKVnd,
      liquidityCapPct: Number.isFinite(liquidityCapFrac) ? liquidityCapFrac : null,
      symbolAvgDailyValueVnd,
    });
  }, [
    equity,
    maxPortPct,
    currentExp,
    maxTradePct,
    baseRiskPct,
    liquidityCapPct,
    entryK,
    stopK,
    quality,
    symbolAvgDailyValueVnd,
  ]);

  return (
    <div className="tosv3-setups-sizing-panel" data-testid="setups-position-sizing">
      <p className="tosv3-setups-sizing-panel__hint">
        {symbolKey} · Tier {quality} · k ₫ prices · guidance only
      </p>

      <div className="tosv3-setups-sizing-panel__group">
        <p className="tosv3-setups-sizing-panel__group-title">Account &amp; exposure</p>
        <div className="tosv3-setups-sizing-panel__fields">
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Equity (₫)</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={equity}
              onChange={(e) => setEquity(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Max port %</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={maxPortPct}
              onChange={(e) => setMaxPortPct(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Current exp (₫)</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={currentExp}
              onChange={(e) => setCurrentExp(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Max trade %</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={maxTradePct}
              onChange={(e) => setMaxTradePct(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Base risk %</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={baseRiskPct}
              onChange={(e) => setBaseRiskPct(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
      </div>

      <div className="tosv3-setups-sizing-panel__group">
        <p className="tosv3-setups-sizing-panel__group-title">Entry &amp; stop</p>
        <div className="tosv3-setups-sizing-panel__fields tosv3-setups-sizing-panel__fields--2">
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Entry (k ₫)</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={entryK}
              onChange={(e) => setEntryK(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Stop (k ₫)</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={stopK}
              onChange={(e) => setStopK(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
      </div>

      <div className="tosv3-setups-sizing-panel__group">
        <p className="tosv3-setups-sizing-panel__group-title">Liquidity</p>
        <div className="tosv3-setups-sizing-panel__fields tosv3-setups-sizing-panel__fields--2">
          <label className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">Liquidity cap (% of ADV)</span>
            <input
              className="input tosv3-setups-sizing-field__input"
              value={liquidityCapPct}
              onChange={(e) => setLiquidityCapPct(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <div className="tosv3-setups-sizing-field">
            <span className="tosv3-setups-sizing-field__label">20D ADV (₫)</span>
            <p className="tosv3-setups-sizing-panel__adv-readout tabular-nums">
              {symbolAvgDailyValueVnd != null ? formatVND(symbolAvgDailyValueVnd) : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="tosv3-setups-sizing-panel__results">
        {!computed.ok ? (
          <p className="tosv3-setups-sizing-panel__error">
            {computed.code === "ENTRY_NOT_ABOVE_STOP"
              ? "Entry must be above stop for long risk sizing."
              : computed.code === "ZERO_EQUITY"
                ? "Enter a positive account equity."
                : "Check numeric inputs."}
          </p>
        ) : (
          <dl className="tosv3-setups-sizing-results">
            <div>
              <dt>Shares</dt>
              <dd className="mono tabular-nums">
                {computed.value.qFinalShares.toLocaleString("en-US")}
                {computed.value.liquidityCapBinding ? (
                  <span className="tosv3-setups-sizing-panel__liquidity-flag" title="Capped by liquidity (% of ADV), not by risk or exposure">
                    {" "}
                    (liquidity-capped)
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Notional</dt>
              <dd className="tabular-nums">{formatVND(computed.value.notionalVnd)}</dd>
            </div>
            <div>
              <dt>Risk at stop</dt>
              <dd className="tabular-nums">{formatVND(computed.value.riskAtStopVnd)}</dd>
            </div>
            <div>
              <dt>Stop dist</dt>
              <dd className="tabular-nums">{computed.value.stopDistancePctOfEntry.toFixed(2)}%</dd>
            </div>
            <div>
              <dt>Position %</dt>
              <dd className="tabular-nums">{computed.value.positionPctOfAccount.toFixed(2)}%</dd>
            </div>
            <div>
              <dt>Exp after</dt>
              <dd className="tabular-nums">{formatVND(computed.value.exposureAfterTradeVnd)}</dd>
            </div>
            <div className="tosv3-setups-sizing-results__wide">
              <dt>Remaining capacity</dt>
              <dd className="tabular-nums">{formatVND(computed.value.remainingExposureAfterTradeVnd)}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
});
