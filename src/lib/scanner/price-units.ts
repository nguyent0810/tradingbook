/**
 * vnstock / VCI equity EOD `open` / `high` / `low` / `close` are quoted in **thousand VND**
 * per share ("nghìn đồng"). Index benchmarks (e.g. VNINDEX) use **index points** instead —
 * do not pass index OHLC through these helpers for tradability.
 */

/** Thousand-VND quote → nominal VND per share. */
export function equityPriceToVnd(price: number): number {
  return price * 1000;
}

/** Traded value in VND for one session (thousand-VND close × share volume). */
export function tradedValueVnd(close: number, volume: number): number {
  return close * 1000 * volume;
}
