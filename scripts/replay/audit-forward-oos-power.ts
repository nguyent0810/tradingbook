/**
 * READ-ONLY: §13 — how long must a forward holdout run before it can answer
 * anything?
 *
 * Computed from in-sample quantities only, before any forward outcome exists,
 * so that the stopping rule is frozen rather than chosen once results look
 * interesting. Uses the same measured ICC (0.0829) and the observed recent
 * setup rate.
 *
 *   npx tsx scripts/replay/audit-forward-oos-power.ts
 */
import "../load-env";

// Both measured in audit-oos-clustering.ts on the 574 scored in-sample setups.
// Symbol-level ICC came out at exactly 0, so symbol is not a cluster level that
// needs carrying; month and quarter are the two candidates.
const ICC_MONTH = 0.0829;
const ICC_QUARTER = 0.0609;
const PERIODS_PER_YEAR = { month: 12, quarter: 4 } as const;
const ICC = { month: ICC_MONTH, quarter: ICC_QUARTER } as const;
type Level = keyof typeof ICC;

const BREAKEVEN = 1 / 3; // P(continuation) that makes a 2:1 payoff flat
const SETUPS_PER_YEAR = 78; // 2023-2025 unique setups: 80, 72, 70 -> mean 74; recent mean 78
const Z975 = 1.96;
const Z95 = 1.6449;
const Z80 = 0.8416;

/** SE of a proportion under clustering at `level`, for `n` setups over `years`. */
function se(n: number, years: number, level: Level, p = BREAKEVEN): number {
  const clusters = Math.max(1, years * PERIODS_PER_YEAR[level]);
  const m = n / clusters;
  const deff = 1 + Math.max(0, m - 1) * ICC[level];
  return Math.sqrt((p * (1 - p)) / n) * Math.sqrt(deff);
}

/** Smallest n whose MDE at 80% power is at or below `target`. */
function nFor(target: number, oneSided: boolean, level: Level): { n: number; months: number } {
  const z = (oneSided ? Z95 : Z975) + Z80;
  for (let n = 20; n <= 40000; n++) {
    const years = n / SETUPS_PER_YEAR;
    if (z * se(n, years, level) <= target) return { n, months: Math.round(years * 12) };
  }
  return { n: NaN, months: NaN };
}

function main(): void {
  console.log(
    `assumptions: ICC month=${ICC_MONTH} quarter=${ICC_QUARTER} (symbol ICC measured at 0) · ` +
      `setups/year=${SETUPS_PER_YEAR} · breakeven=${(100 * BREAKEVEN).toFixed(1)}%`,
  );

  console.log("\nHOW LONG TO DETECT A GIVEN DISTANCE FROM BREAKEVEN (80% power, one-sided)");
  console.log("effect    month-clustered n   years    quarter-clustered n   years");
  for (const eff of [0.04, 0.05, 0.0623, 0.075, 0.1, 0.125]) {
    const a = nFor(eff, true, "month");
    const b = nFor(eff, true, "quarter");
    console.log(
      `${(100 * eff).toFixed(2)}pp   ${String(a.n).padStart(15)}   ${(a.n / SETUPS_PER_YEAR).toFixed(1).padStart(5)}   ${String(b.n).padStart(19)}   ${(b.n / SETUPS_PER_YEAR).toFixed(1).padStart(5)}`,
    );
  }

  console.log("\nWHAT A GIVEN WAIT BUYS (one-sided MDE at 80% power)");
  console.log("years  setups   SE(month)  MDE(month)   SE(quarter)  MDE(quarter)");
  for (const yrs of [1, 2, 3, 4, 5, 6, 8, 10]) {
    const n = Math.round(yrs * SETUPS_PER_YEAR);
    const sm = se(n, yrs, "month");
    const sq = se(n, yrs, "quarter");
    console.log(
      `${String(yrs).padStart(5)}  ${String(n).padStart(6)}   ${(100 * sm).toFixed(2)}pp     ${(100 * (Z95 + Z80) * sm).toFixed(2)}pp` +
        `        ${(100 * sq).toFixed(2)}pp      ${(100 * (Z95 + Z80) * sq).toFixed(2)}pp`,
    );
  }
  void Z975;

  console.log(
    "\nreference distances: new era 27.1% is 6.23pp below breakeven;" +
      " old era 40.8% is 7.52pp above it.",
  );
}

main();
