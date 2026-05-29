import { describe, expect, it } from "vitest";
import {
  GATE2_REJECTION_CODES,
  inferGate2RejectionCodeFromMessage,
  resolveTerminalClassification,
} from "./rejection-codes";
import { categorizeTerminalReason } from "@/lib/scanner/gate2-scan-diagnostics";

const MESSAGE_FIXTURES: Array<{ msg: string; code: (typeof GATE2_REJECTION_CODES)[number] }> = [
  { msg: "Need at least 50 daily bars (got 12).", code: "insufficient_bars" },
  {
    msg: "Latest bar date 2026-05-01 does not match expected session 2026-05-25.",
    code: "stale_or_session_mismatch",
  },
  { msg: "Could not compute MA20/MA50 at evaluation bar.", code: "ma_compute" },
  {
    msg: "Trend not supportive for long swings—price finished below its 50-day average.",
    code: "trend_below_ma50",
  },
  {
    msg: "Intermediate trend weaker than slow trend—wait for MA20 ≥ MA50 before breakout-pullback entries.",
    code: "trend_ma20_below_ma50",
  },
  { msg: "No qualifying breakout in the last 10 sessions—need a fresh push.", code: "breakout_recency" },
  { msg: "Need a digestion dip after the impulse—no session yet traded below.", code: "digestion" },
  {
    msg: "Setup failed—session closed back under resistance 100.00; former breakout not holding.",
    code: "breakout_not_holding",
  },
  {
    msg: "Mid-pullback close dipped under the 50-day line before today—reset and wait.",
    code: "mid_pullback_below_ma50",
  },
  {
    msg: "Lower lows vs the breakout session with a weak finish—pattern broken for this template.",
    code: "swept_breakout_weak_close",
  },
  {
    msg: "Two closes in a row under the pullback zone floor—stand aside until price reclaims the zone.",
    code: "pullback_zone_two_closes",
  },
  {
    msg: "Current bar does not interact with the pullback box (10.00–12.00)—no actionable entry location yet.",
    code: "pullback_zone_interaction",
  },
  { msg: "Pullback zone is malformed (floor above ceiling).", code: "pullback_zone_malformed" },
  {
    msg: "Cannot score participation—median volume over the prior 20 sessions is unusable.",
    code: "volume_median_bad",
  },
  {
    msg: "Participation too thin—today’s volume is 0.90× the 20-day median (need ≥ 1.2×).",
    code: "volume_ratio",
  },
  {
    msg: "Entry is 12.00% above the breakout level—exceeds the 5% swing cap (avoid chasing).",
    code: "extension_cap",
  },
  {
    msg: "Pullback violated 4% max depth under the breakout—retracement 6.00% is too heavy for this playbook.",
    code: "depth_cap",
  },
  {
    msg: "Stop would be at or above entry—no actionable downside anchor for a long.",
    code: "stop_structure",
  },
];

describe("inferGate2RejectionCodeFromMessage", () => {
  it.each(MESSAGE_FIXTURES)("maps $code", ({ msg, code }) => {
    expect(inferGate2RejectionCodeFromMessage(msg)).toBe(code);
  });
});

describe("resolveTerminalClassification", () => {
  it("prefers persisted terminalCode over message inference", () => {
    const r = resolveTerminalClassification({
      terminalCode: "digestion",
      terminalMessage: "Trend not supportive for long swings",
    });
    expect(r.code).toBe("digestion");
    expect(r.category).toBe("digestion");
  });

  it("legacy categorizeTerminalReason stays aligned with inference", () => {
    for (const { msg, code } of MESSAGE_FIXTURES) {
      const legacy = categorizeTerminalReason(msg);
      const resolved = resolveTerminalClassification({ terminalMessage: msg });
      expect(resolved.code).toBe(code);
      expect(legacy.category).toBe(code);
    }
  });
});
