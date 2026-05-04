/**
 * Indicator math only — no domain types (see `@/lib/market/types`).
 */

/**
 * Simple moving average over the last `period` values.
 * Entry `i` is the SMA of values[i - period + 1] .. values[i]; earlier indices are `undefined`.
 */
export function sma(values: readonly number[], period: number): (number | undefined)[] {
  if (period <= 0 || values.length === 0) {
    return values.map(() => undefined);
  }

  const out: (number | undefined)[] = [];
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      out.push(sum / period);
    } else {
      out.push(undefined);
    }
  }

  return out;
}
