import type { Gate2BarInput } from "@/lib/scanner/gate2/types";
import { sortDedupeGate2Bars } from "@/lib/scanner/gate2/breakout-pullback";
import { sma } from "@/lib/playbook/indicators";

export function utcDayKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return x.toISOString().slice(0, 10);
}

export function mean(nums: readonly number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeAtr14(bars: readonly Gate2BarInput[], idx: number): number | null {
  if (idx < 14) return null;
  const trs: number[] = [];
  for (let i = idx - 13; i <= idx; i++) {
    const cur = bars[i]!;
    const prev = bars[i - 1]!;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }
  return mean(trs);
}

export function hadCloseBelowLevel(
  closes: readonly number[],
  levelSeries: readonly (number | undefined)[],
  endIdx: number,
  lookback: number
): boolean {
  const start = Math.max(0, endIdx - lookback + 1);
  for (let i = start; i <= endIdx; i++) {
    const lv = levelSeries[i];
    if (lv != null && Number.isFinite(lv) && closes[i]! < lv) return true;
  }
  return false;
}

export function detectPriorCompression(
  bars: readonly Gate2BarInput[],
  idx: number,
  lookback = 5
): boolean {
  if (idx < lookback + 14) return false;
  const ranges: number[] = [];
  for (let i = idx - lookback; i < idx; i++) {
    const b = bars[i]!;
    ranges.push((b.high - b.low) / b.close);
  }
  const recentAvg = mean(ranges);
  const atr = computeAtr14(bars, idx - 1);
  const bar = bars[idx]!;
  const todayRange = (bar.high - bar.low) / bar.close;
  if (recentAvg == null || atr == null) return false;
  return recentAvg < (atr / bar.close) * 0.85 && todayRange > recentAvg * 1.1;
}

export function detectPocketPivot(bars: readonly Gate2BarInput[], idx: number): boolean {
  if (idx < 10) return false;
  const cur = bars[idx]!;
  let maxDownVol = 0;
  for (let i = idx - 10; i < idx; i++) {
    const b = bars[i]!;
    const prev = bars[i - 1];
    if (prev && b.close < prev.close && b.volume > maxDownVol) {
      maxDownVol = b.volume;
    }
  }
  if (maxDownVol <= 0) return false;
  return cur.close > bars[idx - 1]!.close && cur.volume > maxDownVol;
}

export function computeMaAtIndex(
  bars: readonly Gate2BarInput[],
  idx: number
): { ma20: number | null; ma50: number | null; ma20Series: (number | undefined)[]; ma50Series: (number | undefined)[] } {
  const closes = bars.map((b) => b.close);
  const ma20Series = sma(closes, 20);
  const ma50Series = sma(closes, 50);
  const ma20 = ma20Series[idx] ?? null;
  const ma50 = ma50Series[idx] ?? null;
  return { ma20, ma50, ma20Series, ma50Series };
}

export function volumeMa20AtIndex(bars: readonly Gate2BarInput[], idx: number): number | null {
  const volSlice = bars.slice(Math.max(0, idx - 20), idx).map((b) => b.volume);
  return volSlice.length > 0 ? mean(volSlice) : null;
}

export function barsThroughSession(
  bars: readonly Gate2BarInput[],
  sessionDate: Date
): { sorted: Gate2BarInput[]; idx: number } | null {
  const sorted = sortDedupeGate2Bars(bars);
  const target = utcDayKey(sessionDate);
  const idx = sorted.findIndex((b) => utcDayKey(b.date) === target);
  if (idx < 0) return null;
  return { sorted: sorted.slice(0, idx + 1), idx };
}
