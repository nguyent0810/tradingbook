export type TradabilityResult = {
  passed: boolean;
  reasons: string[];
};

export type TradabilityAggregate = {
  totalSymbols: number;
  passedTradability: number;
  filteredOut: number;
  /** Count of failure mentions per reason code (a symbol may increment multiple keys). */
  breakdownByReason: Record<string, number>;
};

/** One row of EOD data used by the tradability filter. */
export type TradabilityBarInput = {
  date: Date;
  close: number;
  volume: number;
};

export type TradabilityBatchItem = {
  symbolKey: string;
  symbolId: string;
  result: TradabilityResult;
};
