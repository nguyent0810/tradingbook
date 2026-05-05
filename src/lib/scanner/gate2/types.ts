export type Gate2Quality = "A" | "B" | "INVALID";

/** Gate 1 market regime level — filters which Gate 2 qualities surface. */
export type Gate1Level = "PASS" | "WARNING" | "FAIL";

/** Minimal bar shape for Gate 2 (compatible with Prisma `StockDailyBar`). */
export type Gate2BarInput = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type BreakoutPullbackEvaluation = {
  quality: Gate2Quality;
  rankScore: number;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  /** Evaluation bar close (invalid runs may use last bar close when available). */
  close: number;
  reasons: string[];
  barDate: Date;
};

export type SetupCandidate = {
  symbolId: string;
  quality: "A" | "B";
  close: number;
  rankScore: number;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  reasons: string[];
  barDate: Date;
};
