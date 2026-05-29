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

import type { Gate2RankComponents } from "./rank-components";
import type { Gate2RejectionCode } from "./rejection-codes";

export type BreakoutPullbackEvaluation = {
  quality: Gate2Quality;
  rankScore: number;
  /** Present for Tier A/B — decomposed rank terms (does not change rankScore). */
  rankComponents?: Gate2RankComponents;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  /** Evaluation bar close (invalid runs may use last bar close when available). */
  close: number;
  reasons: string[];
  /** Stable terminal code when `quality === INVALID`. */
  terminalCode?: Gate2RejectionCode;
  barDate: Date;
};

export type SetupCandidate = {
  symbolId: string;
  quality: "A" | "B";
  close: number;
  rankScore: number;
  rankComponents?: Gate2RankComponents;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
  reasons: string[];
  barDate: Date;
};
