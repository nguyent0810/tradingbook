import { SetupLifecycleStatus } from "@/generated/prisma/client";
import {
  displayCandidateLifecycleSortLabel,
  displaySetupLifecycleStatus,
} from "@/lib/trading-display-labels";

export type SetupLifecycleSource = "db" | "computed" | "fallback";

/** Canonical setup lifecycle contract for future Dashboard / Setups UI (P1 foundation). */
export type SetupLifecycleDto = {
  /** Raw status key (DB enum or computed READY | WATCHING). */
  status: string;
  /** Trader-facing label (matches current display helpers). */
  label: string;
  /** Sort rank for lists (lower = earlier). Aligns with `sortCandidatesWithHealth` READY < WATCHING < NEW. */
  sortRank: number;
  source: SetupLifecycleSource;
  /** Set when DB watch status and computed surfaced label may diverge in meaning. */
  warning?: string;
};

const DB_SORT_RANK: Record<SetupLifecycleStatus, number> = {
  READY: 0,
  WATCHING: 1,
  NEW: 2,
  TRIGGERED: 3,
  EXPIRED: 4,
  INVALID: 5,
};

const SURFACED_SORT_RANK: Record<"READY" | "WATCHING", number> = {
  READY: 0,
  WATCHING: 1,
};

/** From `setup_watch_items.lifecycle_status` / DB enum — does not change DB behavior. */
export function normalizeSetupLifecycleFromDb(
  status: SetupLifecycleStatus
): SetupLifecycleDto {
  return {
    status,
    label: displaySetupLifecycleStatus(status),
    sortRank: DB_SORT_RANK[status] ?? 99,
    source: "db",
  };
}

/** From surfaced candidate `lifecycleSortLabel` (close in pullback zone). */
export function normalizeSetupLifecycleFromSurfacedSortLabel(
  label: "READY" | "WATCHING"
): SetupLifecycleDto {
  return {
    status: label,
    label: displayCandidateLifecycleSortLabel(label),
    sortRank: SURFACED_SORT_RANK[label],
    source: "computed",
  };
}

/** Same rule as `prepareSurfacedCandidatesHealthView` (price vs pullback zone). */
export function normalizeSetupLifecycleFromCloseInZone(params: {
  close: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
}): SetupLifecycleDto {
  const inZone =
    params.close >= params.pullbackZoneLow &&
    params.close <= params.pullbackZoneHigh;
  return normalizeSetupLifecycleFromSurfacedSortLabel(inZone ? "READY" : "WATCHING");
}

/** Unknown string — preserves prior `displaySetupLifecycleStatus` fallback behavior. */
export function normalizeSetupLifecycleFallback(raw: string): SetupLifecycleDto {
  const known = Object.values(SetupLifecycleStatus).includes(raw as SetupLifecycleStatus);
  if (known) {
    return normalizeSetupLifecycleFromDb(raw as SetupLifecycleStatus);
  }
  return {
    status: raw,
    label: displaySetupLifecycleStatus(raw),
    sortRank: 99,
    source: "fallback",
    warning: "Unrecognized lifecycle status — using display fallback.",
  };
}

/**
 * Optional merge when both DB watch row and surfaced computed label exist.
 * Does not pick a winner — returns computed DTO with warning if statuses differ in rank bucket.
 */
export function normalizeSetupLifecycleWithWatchContext(params: {
  computed: "READY" | "WATCHING";
  dbStatus: SetupLifecycleStatus | null | undefined;
}): SetupLifecycleDto {
  const dto = normalizeSetupLifecycleFromSurfacedSortLabel(params.computed);
  if (params.dbStatus == null) return dto;

  const dbDto = normalizeSetupLifecycleFromDb(params.dbStatus);
  const dbProximity =
    params.dbStatus === SetupLifecycleStatus.READY ||
    params.dbStatus === SetupLifecycleStatus.WATCHING;
  if (
    dbProximity &&
    params.computed === "READY" &&
    params.dbStatus === SetupLifecycleStatus.WATCHING
  ) {
    return {
      ...dto,
      warning: `Surfaced label is READY (${dto.label}) but watch DB status is WATCHING (${dbDto.label}). Existing UI keeps separate semantics until DTO adoption.`,
    };
  }
  if (
    dbProximity &&
    params.computed === "WATCHING" &&
    params.dbStatus === SetupLifecycleStatus.READY
  ) {
    return {
      ...dto,
      warning: `Surfaced label is WATCHING (${dto.label}) but watch DB status is READY (${dbDto.label}). Existing UI keeps separate semantics until DTO adoption.`,
    };
  }
  return dto;
}
