"use client";

import { useMemo, useState } from "react";
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

type Props = {
  symbolKey: string;
  quality: PositionSizingQuality;
  defaultEntryKVnd: number;
  defaultStopKVnd: number;
};

export function SetupsCandidatePositionSizing({
  symbolKey,
  quality,
  defaultEntryKVnd,
  defaultStopKVnd,
}: Props) {
  const [equity, setEquity] = useState("500000000");
  const [maxPortPct, setMaxPortPct] = useState("70");
  const [currentExp, setCurrentExp] = useState("0");
  const [maxTradePct, setMaxTradePct] = useState("20");
  const [baseRiskPct, setBaseRiskPct] = useState("1");
  const [entryK, setEntryK] = useState(String(defaultEntryKVnd));
  const [stopK, setStopK] = useState(String(defaultStopKVnd));

  const computed = useMemo(() => {
    const accountEquityVnd = parseMoney(equity);
    const maxPortfolioExposurePct = parsePctToFrac(maxPortPct);
    const currentPortfolioExposureVnd = parseMoney(currentExp);
    const maxPerTradeExposurePct = parsePctToFrac(maxTradePct);
    const baseRiskPerTradePct = parsePctToFrac(baseRiskPct);
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
    });
  }, [
    equity,
    maxPortPct,
    currentExp,
    maxTradePct,
    baseRiskPct,
    entryK,
    stopK,
    quality,
  ]);

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
        Position sizing · {symbolKey} · Tier {quality}
      </p>
      <p className="mt-1 text-xs leading-snug" style={{ color: "var(--text-tertiary)" }}>
        Scanner prices are k ₫; equity and exposures are full ₫. Guidance only — not a buy order.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="label">Account equity (₫)</span>
          <input className="input mt-1" value={equity} onChange={(e) => setEquity(e.target.value)} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="label">Max portfolio exposure (%)</span>
          <input
            className="input mt-1"
            value={maxPortPct}
            onChange={(e) => setMaxPortPct(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className="label">Current portfolio exposure (₫)</span>
          <input
            className="input mt-1"
            value={currentExp}
            onChange={(e) => setCurrentExp(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className="label">Max per-trade exposure (% of equity)</span>
          <input
            className="input mt-1"
            value={maxTradePct}
            onChange={(e) => setMaxTradePct(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className="label">Base risk per trade (% of equity)</span>
          <input
            className="input mt-1"
            value={baseRiskPct}
            onChange={(e) => setBaseRiskPct(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block">
          <span className="label">Entry (k ₫)</span>
          <input className="input mt-1" value={entryK} onChange={(e) => setEntryK(e.target.value)} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="label">Stop (k ₫)</span>
          <input className="input mt-1" value={stopK} onChange={(e) => setStopK(e.target.value)} inputMode="decimal" />
        </label>
      </div>

      <div className="mt-4 border-t pt-4 text-sm" style={{ borderColor: "var(--border-primary)" }}>
        {!computed.ok ? (
          <p style={{ color: "var(--danger)" }}>
            {computed.code === "ENTRY_NOT_ABOVE_STOP"
              ? "Entry must be above stop for long risk sizing."
              : computed.code === "ZERO_EQUITY"
                ? "Enter a positive account equity."
                : "Check numeric inputs."}
          </p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2">
            <div style={{ color: "var(--text-secondary)" }}>
              <dt className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Shares (floored)
              </dt>
              <dd className="mono font-semibold" style={{ color: "var(--text-primary)" }}>
                {computed.value.qFinalShares.toLocaleString("en-US")}
              </dd>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              <dt className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Capital used (notional)
              </dt>
              <dd className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatVND(computed.value.notionalVnd)}
              </dd>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              <dt className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Risk at stop (₫)
              </dt>
              <dd className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatVND(computed.value.riskAtStopVnd)}
              </dd>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              <dt className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Stop distance (% of entry)
              </dt>
              <dd className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {computed.value.stopDistancePctOfEntry.toFixed(2)}%
              </dd>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              <dt className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Position % of account
              </dt>
              <dd className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {computed.value.positionPctOfAccount.toFixed(2)}%
              </dd>
            </div>
            <div style={{ color: "var(--text-secondary)" }}>
              <dt className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Exposure after trade (₫)
              </dt>
              <dd className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {formatVND(computed.value.exposureAfterTradeVnd)}
              </dd>
            </div>
            <div className="sm:col-span-2" style={{ color: "var(--text-secondary)" }}>
              <dt className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Remaining portfolio exposure capacity after trade (₫)
              </dt>
              <dd className="font-semibold" style={{ color: "var(--accent-text)" }}>
                {formatVND(computed.value.remainingExposureAfterTradeVnd)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}
