import { describe, expect, it } from "vitest";
import {
  createPointInTimeGuard,
  isoDay,
  PointInTimeViolationError,
  splitAtSession,
} from "./point-in-time-guard";
import { evaluateBreakoutPullbackCandidate } from "@/lib/scanner/gate2";
import { evaluateTradability } from "@/lib/scanner/tradability";
import type { Gate2BarInput } from "@/lib/scanner/gate2/types";

const SESSION = "2024-06-28";
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * A history whose FUTURE half is poisoned with absurd values.
 *
 * If any decision path reads past the session, the poisoned bars change the
 * result in an obvious way — so these tests can prove isolation by outcome, not
 * merely by inspecting call sites.
 */
function poisonedHistory(sessionIso: string, days: number): Gate2BarInput[] {
  const out: Gate2BarInput[] = [];
  const start = Date.parse(`${sessionIso}T00:00:00.000Z`) - (days / 2) * 86_400_000;
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86_400_000);
    const future = isoDay(date) > sessionIso;
    const base = future ? 1_000_000 : 20 + (i % 5) * 0.1;
    out.push({
      date,
      open: base,
      high: base * 1.02,
      low: base * 0.98,
      close: base,
      volume: future ? 9_999_999_999 : 500_000 + i * 10,
    });
  }
  return out;
}

describe("splitAtSession", () => {
  it("puts the session bar itself on the decision side", () => {
    const rows = [{ date: d("2024-06-27") }, { date: d(SESSION) }, { date: d("2024-07-01") }];
    const { decision, outcome } = splitAtSession(rows, SESSION);
    expect(decision.map((r) => isoDay(r.date))).toEqual(["2024-06-27", SESSION]);
    expect(outcome.map((r) => isoDay(r.date))).toEqual(["2024-07-01"]);
  });

  it("ignores intraday time components when comparing", () => {
    const rows = [{ date: new Date(`${SESSION}T23:59:59.000Z`) }];
    expect(splitAtSession(rows, SESSION).decision).toHaveLength(1);
  });
});

describe("createPointInTimeGuard", () => {
  it("passes clean decision rows through untouched", () => {
    const g = createPointInTimeGuard(SESSION);
    const rows = [{ date: d("2024-06-01") }, { date: d(SESSION) }];
    expect(g.decisionRows("bars", rows)).toBe(rows);
    expect(g.violations).toEqual([]);
  });

  it("throws and records when a decision read sees a future row", () => {
    const g = createPointInTimeGuard(SESSION);
    expect(() => g.decisionRows("bars", [{ date: d("2024-07-01") }])).toThrow(
      PointInTimeViolationError
    );
    expect(g.violations[0]).toMatchObject({
      label: "bars",
      sessionDate: SESSION,
      offendingDate: "2024-07-01",
    });
  });

  it("catches a future date passed as a scalar, not just as rows", () => {
    const g = createPointInTimeGuard(SESSION);
    expect(() => g.decisionDate("regimeSession", d("2024-08-01"))).toThrow(
      PointInTimeViolationError
    );
  });

  it("allows outcome reads to see the future but records the label", () => {
    // Forward returns legitimately need future bars; the point is that they are
    // named, so a decision path cannot escape the check by relabelling.
    const g = createPointInTimeGuard(SESSION);
    g.outcomeRows("forwardReturns", [{ date: d("2024-07-20") }]);
    expect(g.violations).toEqual([]);
    expect(g.outcomeReads).toEqual(["forwardReturns"]);
  });

  it("can collect violations without throwing, for auditing a whole run", () => {
    const g = createPointInTimeGuard(SESSION, { throwOnViolation: false });
    g.decisionRows("a", [{ date: d("2024-07-01") }]);
    g.decisionRows("b", [{ date: d("2024-09-01") }]);
    expect(g.violations).toHaveLength(2);
  });
});

describe("the real scanner sees nothing after T", () => {
  it("Gate 2 given only decision-side bars never touches the poisoned future", () => {
    const full = poisonedHistory(SESSION, 200);
    const { decision, outcome } = splitAtSession(full, SESSION);
    expect(outcome.length).toBeGreaterThan(0); // the poison exists

    const g = createPointInTimeGuard(SESSION);
    const ev = evaluateBreakoutPullbackCandidate(g.decisionRows("gate2Bars", decision), d(SESSION));

    expect(g.violations).toEqual([]);
    // Every price the evaluation reports must come from the pre-session regime,
    // never from the 1,000,000-priced future.
    const reported = [ev.close, ev.breakoutLevel, ev.stopLevel].filter(
      (v): v is number => typeof v === "number" && v > 0
    );
    for (const v of reported) expect(v).toBeLessThan(1000);
  });

  it("tradability flips its verdict if the future leaks — and does not", () => {
    // Built so the two channels disagree: the pre-session history is genuinely
    // illiquid and must FAIL, while the poisoned future is hugely liquid and
    // would PASS. A leak is therefore visible as a flipped verdict, not just as
    // a slightly different number.
    const bars: Array<{ date: Date; close: number; volume: number }> = [];
    const start = Date.parse(`${SESSION}T00:00:00.000Z`) - 200 * 86_400_000;
    for (let i = 0; i < 260; i++) {
      const date = new Date(start + i * 86_400_000);
      const future = isoDay(date) > SESSION;
      bars.push({
        date,
        close: future ? 500 : 5,
        volume: future ? 9_999_999_999 : 1_000,
      });
    }
    const { decision } = splitAtSession(bars, SESSION);
    const g = createPointInTimeGuard(SESSION);

    const clean = evaluateTradability(g.decisionRows("tradabilityBars", decision), d(SESSION));
    expect(g.violations).toEqual([]);
    expect(clean.passed).toBe(false);
    // The genuine pre-session illiquidity is what fails it.
    expect(clean.reasons.join(" ")).toMatch(/volume/i);
    expect(clean.reasons.join(" ")).toMatch(/value/i);

    // Control, and the reason this guard exists: `evaluateTradability` takes the
    // LAST 20 bars of whatever it is handed and uses `expectedLatestSession` only
    // as a staleness check — it does not filter. Handed the future, its liquidity
    // maths silently switches to future volumes and the illiquidity disappears.
    // The function is not self-protecting; the caller must slice, and the guard
    // is what makes that failure loud instead of invisible.
    const leaked = evaluateTradability(bars, d(SESSION));
    expect(leaked.reasons.join(" ")).not.toMatch(/volume/i);
    expect(leaked.reasons.join(" ")).not.toMatch(/value/i);
  });

  it("FAILS LOUDLY if the full history is handed to a decision path by mistake", () => {
    // The negative control. Without it, the tests above only prove that correct
    // input produces correct output — not that wrong input is detected.
    const full = poisonedHistory(SESSION, 200);
    const g = createPointInTimeGuard(SESSION);
    expect(() => g.decisionRows("gate2Bars", full)).toThrow(PointInTimeViolationError);
    expect(g.violations[0]!.offendingDate > SESSION).toBe(true);
  });
});
