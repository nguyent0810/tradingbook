/**
 * Smoke script — run: `npx tsx src/lib/playbook/gate1-market.smoke.ts`
 */
import type { Bar } from "@/lib/market/types";
import { evaluateMarketRegime } from "./gate1-market";

const MS_PER_DAY = 86_400_000;
const MOCK_START_MS = Date.UTC(2024, 0, 2);

/** Synthetic uptrend: price stair-steps above a rising MA50 window */
function mockBullishPass(): Bar[] {
  const bars: Bar[] = [];
  let close = 1000;
  for (let i = 0; i < 55; i++) {
    close += i < 52 ? 2.5 : 8;
    const o = close - 1;
    bars.push({
      time: MOCK_START_MS + i * MS_PER_DAY,
      open: o,
      high: close + 1,
      low: o - 0.5,
      close,
      volume: 1_000_000 + i * 1000,
    });
  }
  return bars;
}

/** Price below MA50; last 3 closes strictly down */
function mockBearishFail(): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < 55; i++) {
    const base = 1200 - i * 3;
    const jitter = i >= 52 ? -15 : 0;
    const c = base + jitter;
    bars.push({
      time: MOCK_START_MS + i * MS_PER_DAY,
      open: c + 2,
      high: c + 3,
      low: c - 4,
      close: c,
      volume: 800_000,
    });
  }
  return bars;
}

/** Bullish vs MA50 but last 3 closes flat / not strictly rising */
function mockWarningWeakMomentum(): Bar[] {
  const bars = mockBullishPass();
  const n = bars.length;
  bars[n - 3] = { ...bars[n - 3], close: bars[n - 4].close };
  bars[n - 2] = { ...bars[n - 2], close: bars[n - 4].close };
  bars[n - 1] = { ...bars[n - 1], close: bars[n - 4].close + 0.01 };
  return bars;
}

function run(): void {
  const scenarios: { name: string; bars: Bar[] }[] = [
    { name: "PASS (bullish + rising last 3)", bars: mockBullishPass() },
    { name: "FAIL (bearish + falling last 3)", bars: mockBearishFail() },
    { name: "WARNING (bullish trend but weak momentum)", bars: mockWarningWeakMomentum() },
    { name: "WARNING (insufficient bars)", bars: mockBullishPass().slice(0, 30) },
  ];

  for (const { name, bars } of scenarios) {
    const result = evaluateMarketRegime(bars);
    console.log("---");
    console.log(name);
    console.log(JSON.stringify(result, null, 2));
  }
}

run();
