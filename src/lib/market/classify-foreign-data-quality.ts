import type { ForeignDataQuality } from "@/generated/prisma/client";
import type { ForeignSnapshotRow } from "@/lib/market/foreign-flow-types";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

const NUMERIC_KEYS = [
  "buyVolume",
  "sellVolume",
  "netVolume",
  "buyValueVnd",
  "sellValueVnd",
  "netValueVnd",
] as const satisfies readonly (keyof ForeignSnapshotRow)[];

export function classifyForeignDataQuality(row: ForeignSnapshotRow): ForeignDataQuality {
  const values = NUMERIC_KEYS.map((k) => row[k]);
  const present = values.filter((v) => isFiniteNumber(v));
  if (present.length === 0) {
    return "PARTIAL";
  }
  if (present.length < NUMERIC_KEYS.length) {
    return "PARTIAL";
  }
  if (present.every((v) => v === 0)) {
    return "ALL_ZERO";
  }
  return "OK";
}
