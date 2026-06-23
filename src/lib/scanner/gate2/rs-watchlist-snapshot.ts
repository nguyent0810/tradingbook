import type { PrismaClient } from "@/generated/prisma/client";
import { buildSetupReason, buildSetupStateLabel } from "@/lib/dashboard/rs-setup-labels";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import {
  buildRsScoringMapFromEntries,
  isRsScoringV1Enabled,
  type RsScoringV1Result,
} from "./rs-scoring-v1";
import type { RsNearMissWatchlistRow } from "./rs-near-miss-watchlist";
import { toRsNearMissWatchlistEntryDto } from "./rs-near-miss-watchlist";
import type { RsDiagnosticUi } from "./rs-diagnostic-format";

export function isRsWatchlistSnapshotEnabled(): boolean {
  const v = process.env.RS_WATCHLIST_SNAPSHOT_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function tradePermissionFromVerdict(ux: VerdictUxLevel): string {
  switch (ux) {
    case "TRADE":
      return "allowed";
    case "PROBE":
      return "watch_only";
    case "NO_TRADE":
      return "no_trade";
    default:
      return "watch_only";
  }
}

export type PersistRsWatchlistSnapshotParams = {
  sessionDate: Date;
  rows: readonly RsNearMissWatchlistRow[];
  verdictUxLevel: VerdictUxLevel;
  tradabilityPassedCount: number;
  rsUiBySymbol?: ReadonlyMap<string, RsDiagnosticUi | null>;
};

export type PersistRsWatchlistSnapshotResult = {
  runId: string;
  rowCount: number;
  /** true when an existing session run was replaced (idempotent rerun). */
  updated: boolean;
  /** true when no write was needed (same session, empty rows). */
  skipped: boolean;
};

function utcSessionDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildRowCreates(
  params: PersistRsWatchlistSnapshotParams,
  scoringMap: Map<string, RsScoringV1Result>
) {
  return params.rows.map((row, index) => {
    const code = row.terminalCode;
    const scoring = scoringMap.get(row.symbol);
    const entryDto = toRsNearMissWatchlistEntryDto(
      row,
      params.rsUiBySymbol?.get(row.symbol) ?? null
    );
    return {
      rankPosition: index + 1,
      symbol: row.symbol,
      rs20SpreadPct: row.rs20SpreadPct,
      rs50SpreadPct: row.rs50SpreadPct,
      terminalCode: code,
      setupState: buildSetupStateLabel(code),
      setupReason: buildSetupReason(entryDto),
      stageRank: row.stageRank,
      distanceToPullbackZoneFrac: row.distanceToPullbackZoneFrac,
      rsStrengthScore: scoring?.rsStrengthScore ?? null,
      setupReadinessScore: scoring?.setupReadinessScore ?? null,
      rsConfidence: scoring?.rsConfidence ?? null,
    };
  });
}

/**
 * Persist one daily RS watchlist snapshot for backtest / validation.
 * Idempotent per session date: reruns replace rows on the same run, no duplicate runs.
 */
export async function persistRsWatchlistSnapshot(
  prisma: PrismaClient,
  params: PersistRsWatchlistSnapshotParams
): Promise<PersistRsWatchlistSnapshotResult> {
  const sessionDate = utcSessionDate(params.sessionDate);
  const entryDtos = params.rows.map((row) =>
    toRsNearMissWatchlistEntryDto(row, params.rsUiBySymbol?.get(row.symbol) ?? null)
  );

  const scoringMap = isRsScoringV1Enabled()
    ? buildRsScoringMapFromEntries(entryDtos)
    : new Map();

  const scoringVersion = isRsScoringV1Enabled() ? "v1" : "v0";
  const tradePermission = tradePermissionFromVerdict(params.verdictUxLevel);
  const rowCreates = buildRowCreates(params, scoringMap);

  if (params.rows.length === 0) {
    return { runId: "", rowCount: 0, updated: false, skipped: true };
  }

  const existing = await prisma.rsWatchlistSnapshotRun.findUnique({
    where: { sessionDate },
    select: { id: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.rsWatchlistSnapshotRow.deleteMany({ where: { runId: existing.id } }),
      prisma.rsWatchlistSnapshotRun.update({
        where: { id: existing.id },
        data: {
          verdictUxLevel: params.verdictUxLevel,
          tradePermission,
          tradabilityPassedCount: params.tradabilityPassedCount,
          scoringVersion,
          rows: { create: rowCreates },
        },
      }),
    ]);
    return {
      runId: existing.id,
      rowCount: params.rows.length,
      updated: true,
      skipped: false,
    };
  }

  const run = await prisma.rsWatchlistSnapshotRun.create({
    data: {
      sessionDate,
      verdictUxLevel: params.verdictUxLevel,
      tradePermission,
      tradabilityPassedCount: params.tradabilityPassedCount,
      scoringVersion,
      rows: { create: rowCreates },
    },
    select: { id: true },
  });

  return {
    runId: run.id,
    rowCount: params.rows.length,
    updated: false,
    skipped: false,
  };
}
