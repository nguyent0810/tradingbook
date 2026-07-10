/**
 * Phase 2 — Manager state snapshot.
 *
 * Reads ONLY existing tables (portfolio snapshots, trades, calibration) to
 * summarize a manager's recent equity-curve state. Deterministic given DB state;
 * the snapshot is hashed into each decision's metadata for replay. No schema
 * change.
 */
import type { PrismaClient } from "@/generated/prisma/client";

export interface ManagerStateSnapshot {
  agentId: string;
  navVnd: number;
  currentDdPct: number;
  winRate: number;
  winStreakLen: number;
  lossStreakLen: number;
  brierScore: number;
  tradeCount: number;
  snapshotCount: number;
}

const DEFAULT_BRIER = 0.25;

/** Neutral snapshot for managers with no history (deterministic). */
export function neutralManagerState(agentId: string, navVnd: number): ManagerStateSnapshot {
  return {
    agentId,
    navVnd,
    currentDdPct: 0,
    winRate: 0.5,
    winStreakLen: 0,
    lossStreakLen: 0,
    brierScore: DEFAULT_BRIER,
    tradeCount: 0,
    snapshotCount: 0,
  };
}

export async function buildManagerStateSnapshot(
  prisma: PrismaClient,
  agentId: string,
  fallbackNavVnd: number
): Promise<ManagerStateSnapshot> {
  const snaps = await prisma.portfolioSnapshot.findMany({
    where: { portfolio: { agentId } },
    orderBy: { sessionDate: "asc" },
    take: 120,
    select: { navVnd: true },
  });

  let navVnd = fallbackNavVnd;
  let currentDdPct = 0;
  if (snaps.length > 0) {
    let peak = 0;
    for (const s of snaps) {
      const nav = Number(s.navVnd);
      if (nav > peak) peak = nav;
    }
    navVnd = Number(snaps[snaps.length - 1]!.navVnd);
    currentDdPct = peak > 0 ? Math.max(0, ((peak - navVnd) / peak) * 100) : 0;
  }

  const trades = await prisma.paperTrade.findMany({
    where: { position: { portfolio: { agentId } } },
    orderBy: { closedSessionDate: "desc" },
    take: 100,
    select: { realizedPnlVnd: true },
  });

  const outcomes = trades.map((t) => Number(t.realizedPnlVnd));
  const wins = outcomes.filter((p) => p > 0).length;
  const winRate = outcomes.length > 0 ? wins / outcomes.length : 0.5;

  // Streaks from the most recent closed trade backward.
  let winStreakLen = 0;
  let lossStreakLen = 0;
  for (const pnl of outcomes) {
    if (pnl > 0) {
      if (lossStreakLen > 0) break;
      winStreakLen += 1;
    } else if (pnl < 0) {
      if (winStreakLen > 0) break;
      lossStreakLen += 1;
    } else {
      break;
    }
  }

  const cal = await prisma.agentCalibrationDaily.findFirst({
    where: { agentId },
    orderBy: { sessionDate: "desc" },
    select: { brierScore: true },
  });

  return {
    agentId,
    navVnd,
    currentDdPct,
    winRate,
    winStreakLen,
    lossStreakLen,
    brierScore: cal?.brierScore ?? DEFAULT_BRIER,
    tradeCount: outcomes.length,
    snapshotCount: snaps.length,
  };
}
