import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2/breakout-pullback";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";

function bar(
  dayIndex: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): Gate2BarInput {
  const unixSec = 1_700_000_000 + dayIndex * 86_400;
  return { date: new Date(unixSec * 1000), open, high, low, close, volume };
}

const BASE = 200;
const V_BASE = 1_000_000;

function baselineValidPath(volLast: number): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  const lastIdx = 69;
  for (let i = 0; i <= lastIdx; i++) {
    if (i < 59) {
      out.push(bar(i, BASE, BASE, BASE - 1, BASE - 1, V_BASE));
    } else if (i === 59) {
      out.push(bar(i, BASE, BASE + 2, BASE, BASE + 1, V_BASE));
    } else if (i === 60) {
      out.push(bar(i, BASE + 1, BASE + 1, BASE - 3, BASE + 0.5, V_BASE));
    } else if (i < 68) {
      out.push(bar(i, BASE, BASE + 0.6, BASE - 0.2, BASE, V_BASE));
    } else if (i === 68) {
      out.push(bar(i, BASE, BASE + 0.6, BASE - 0.2, BASE + 0.5, V_BASE));
    } else {
      out.push(bar(i, BASE + 5, BASE + 7, BASE - 1, BASE + 6, volLast));
    }
  }
  return out;
}

describe("market context Phase 1A scanner regression", () => {
  it("keeps Gate 2 quality and rankScore decomposition unchanged", () => {
    const path = baselineValidPath(2_000_000);
    const evalDate = path[path.length - 1]!.date;
    const res = evaluateBreakoutPullbackCandidate(path, evalDate);
    expect(res.quality).not.toBe("INVALID");
    expect(res.rankComponents).toBeDefined();
    const parts = res.rankComponents!;
    const sum = parts.volumeTerm + parts.extensionTerm + parts.maDistanceTerm - parts.depthPenalty;
    expect(parts.rankScore).toBe(sum);
    expect(parts.rankScore).toBe(res.rankScore);

    const replay = evaluateBreakoutPullbackCandidate(path, evalDate);
    expect(replay.quality).toBe(res.quality);
    expect(replay.rankScore).toBe(res.rankScore);
  });

  it("does not wire market context into runDailyScanJob", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/scanner/run-daily-scan-job.ts"),
      "utf-8"
    );
    expect(src).not.toMatch(/market-context|foreign_trade_daily|MarketContextDaily|build-market-context/);
  });

  it("does not wire market context into breakout-pullback gate", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/scanner/gate2/breakout-pullback.ts"),
      "utf-8"
    );
    expect(src).not.toMatch(/market-context|foreign_trade_daily|MarketContextDaily/);
  });
});
