export const FOREIGN_FLOW_SOURCE = "vnstock:VCI" as const;
export const FOREIGN_CAPTURE_METHOD = "price_board_eod_snapshot" as const;

export type ForeignSnapshotRow = {
  buyVolume: number | null;
  sellVolume: number | null;
  netVolume: number | null;
  buyValueVnd: number | null;
  sellValueVnd: number | null;
  netValueVnd: number | null;
};

export type ForeignSnapshotSymbolEntry = {
  symbol: string;
  status: "ok" | "error";
  error: string | null;
  sessionHint: string | null;
  row: ForeignSnapshotRow | null;
};

export type ForeignSnapshotFile = {
  meta: {
    source: typeof FOREIGN_FLOW_SOURCE;
    captureMethod: typeof FOREIGN_CAPTURE_METHOD;
    fetchedAt: string;
    sessionDate: string;
    symbolCount: number;
    rowCount: number;
    batchSize: number;
    sleepSec: number;
    warnings: string[];
  };
  symbols: ForeignSnapshotSymbolEntry[];
};
