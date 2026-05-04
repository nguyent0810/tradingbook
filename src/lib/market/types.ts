/**
 * Canonical OHLCV bar for market data (providers, caches, playbook gates).
 * `time` is Unix epoch milliseconds at bar open (daily = session open).
 */
export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
