"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TradeFormSchema, computePnl } from "@/lib/validations";
import { DEFAULT_PLAYBOOK } from "@/lib/playbook-config";
import {
  Prisma,
  ScanQuality,
  ScanSetupType,
  SetupHealthLevel,
  TradeOutcome,
} from "@/generated/prisma/client";
import {
  reviewChecklistFromFormData,
  serializeReviewChecklistForDb,
} from "@/lib/trades/trade-health-review-checklist";

// ─── Types ───

export type TradeActionState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

// ─── Helpers ───

async function requireUser() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

function nullIfBlank(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseSetupSnapshot(raw: string): Prisma.InputJsonValue | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

function computeRMultiple(
  direction: "LONG" | "SHORT",
  entryPrice: number,
  exitPrice: number,
  stopLoss: number
): number | null {
  const riskPerUnit =
    direction === "LONG" ? entryPrice - stopLoss : stopLoss - entryPrice;
  if (!Number.isFinite(riskPerUnit) || riskPerUnit <= 0) return null;
  const rewardPerUnit =
    direction === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return parseFloat((rewardPerUnit / riskPerUnit).toFixed(4));
}

function deriveOutcome(realizedPnl: number | null): TradeOutcome | null {
  if (realizedPnl == null) return null;
  if (realizedPnl > 0) return TradeOutcome.WIN;
  if (realizedPnl < 0) return TradeOutcome.LOSS;
  return TradeOutcome.BREAKEVEN;
}

async function resolveSetupTier(setupId: string): Promise<ScanQuality | null> {
  const setup = await prisma.setupCandidate.findUnique({
    where: { id: setupId },
    select: { quality: true },
  });
  return setup?.quality ?? null;
}

async function writeSetupOutcomeFromTrade(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { setupCandidate: true },
  });
  if (!trade || !trade.setupId || !trade.setupCandidate) return;
  if (trade.status !== "CLOSED") return;

  const setupTier = trade.setupCandidate.quality ?? ScanQuality.B;
  await prisma.setupOutcome.upsert({
    where: { tradeId },
    create: {
      setupId: trade.setupId,
      tradeId: trade.id,
      setupType: ScanSetupType.BREAKOUT_PULLBACK,
      setupTierAtEntry: setupTier,
      entryReason: trade.entryReason,
      entryLocationVsZone: trade.entryLocationVsZone,
      healthLevelAtEntry: trade.healthLevelAtEntry,
      healthLevelAtExit: trade.healthLevelAtEntry,
      exitReason: trade.exitReason,
      exitDiscipline: trade.exitDiscipline,
      rMultiple: trade.rMultiple,
      pnl: trade.realizedPnl,
      outcome: trade.outcome,
    },
    update: {
      setupTierAtEntry: setupTier,
      entryReason: trade.entryReason,
      entryLocationVsZone: trade.entryLocationVsZone,
      healthLevelAtEntry: trade.healthLevelAtEntry,
      healthLevelAtExit: trade.healthLevelAtEntry,
      exitReason: trade.exitReason,
      exitDiscipline: trade.exitDiscipline,
      rMultiple: trade.rMultiple,
      pnl: trade.realizedPnl,
      outcome: trade.outcome,
    },
  });
}

// ─── Create Trade ───

export async function createTrade(
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const session = await requireUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = TradeFormSchema.safeParse(raw);

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const setupId = nullIfBlank(data.setupId);
  const stopLoss = numberOrNull(data.stopLoss);
  const takeProfit = numberOrNull(data.takeProfit);
  const positionSize = numberOrNull(data.positionSize);
  const healthScoreAtEntry = numberOrNull(data.healthScoreAtEntry);
  const setupSnapshot = parseSetupSnapshot(data.setupSnapshot);
  const entryReason = nullIfBlank(data.entryReason);
  const entryLocationVsZone = nullIfBlank(data.entryLocationVsZone);
  const healthLevelAtEntry = nullIfBlank(data.healthLevelAtEntry);
  const exitReason = nullIfBlank(data.exitReason);
  const exitDiscipline = nullIfBlank(data.exitDiscipline);

  // Compute P&L/R if trade is closed with an exit price
  let realizedPnl: number | null = null;
  let rMultiple: number | null = null;
  const exitPriceNum =
    typeof data.exitPrice === "number" ? data.exitPrice : null;

  if (data.status === "CLOSED" && exitPriceNum) {
    realizedPnl = computePnl(
      data.direction,
      data.entryPrice,
      exitPriceNum,
      data.quantity,
      data.fees
    );
    if (stopLoss != null) {
      rMultiple = computeRMultiple(
        data.direction,
        data.entryPrice,
        exitPriceNum,
        stopLoss
      );
    }
  }
  const outcome = deriveOutcome(realizedPnl);

  const setupTier = setupId ? await resolveSetupTier(setupId) : null;
  const immutableSnapshot =
    setupSnapshot ??
    (setupTier
      ? {
          setupId,
          setupType: "BREAKOUT_PULLBACK",
          setupTier,
        }
      : null);

  const created = await prisma.trade.create({
    data: {
      userId: session.userId,
      setupId,
      symbol: data.symbol,
      direction: data.direction,
      status: data.status,
      entryDate: new Date(data.entryDate),
      exitDate: data.exitDate ? new Date(data.exitDate) : null,
      entryPrice: data.entryPrice,
      stopLoss,
      takeProfit,
      positionSize,
      entryReason: entryReason as
        | "ZONE_RETEST"
        | "BREAKOUT_CONFIRM"
        | "PULLBACK_ENTRY"
        | "STRUCTURE_CONTINUATION"
        | "MOMENTUM_CONFIRM"
        | "READY_ON_OPEN"
        | "READY_INTRADAY"
        | "LATE_CHASE"
        | null,
      entryLocationVsZone: entryLocationVsZone as
        | "IN_ZONE"
        | "ABOVE_ZONE"
        | "BELOW_ZONE"
        | null,
      healthLevelAtEntry: healthLevelAtEntry as SetupHealthLevel | null,
      healthScoreAtEntry,
      exitPrice: exitPriceNum,
      exitReason: exitReason as
        | "TAKE_PROFIT_HIT"
        | "STOP_LOSS_HIT"
        | "ZONE_INVALIDATED"
        | "STRUCTURE_BROKEN"
        | "HEALTH_DEGRADED_EOD"
        | "TIME_STOP"
        | "MANUAL_RULE_BASED_EXIT"
        | null,
      exitDiscipline: exitDiscipline as
        | "FOLLOWED_PLAN"
        | "EARLY_EXIT_RULE_BASED"
        | "EMOTIONAL_EXIT"
        | "RULE_VIOLATION"
        | null,
      quantity: data.quantity,
      fees: data.fees,
      playbook: DEFAULT_PLAYBOOK,
      realizedPnl,
      rMultiple,
      outcome,
      setupSnapshot: immutableSnapshot ?? undefined,
      entryNote: data.entryNote || null,
      exitNote: data.exitNote || null,
      notes: data.notes || null,
    },
  });

  if (data.status === "CLOSED") {
    await writeSetupOutcomeFromTrade(created.id);
  }

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  redirect("/trades");
}

// ─── Update Trade ───

export async function updateTrade(
  tradeId: string,
  _prevState: TradeActionState,
  formData: FormData
): Promise<TradeActionState> {
  const session = await requireUser();

  const raw = Object.fromEntries(formData.entries());
  const parsed = TradeFormSchema.safeParse(raw);

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Verify ownership
  const existing = await prisma.trade.findFirst({
    where: { id: tradeId, userId: session.userId },
  });

  if (!existing) {
    return { message: "Trade not found." };
  }

  const setupId = nullIfBlank(data.setupId);
  const stopLoss = numberOrNull(data.stopLoss);
  const takeProfit = numberOrNull(data.takeProfit);
  const positionSize = numberOrNull(data.positionSize);
  const healthScoreAtEntry = numberOrNull(data.healthScoreAtEntry);
  const entryReason = nullIfBlank(data.entryReason);
  const entryLocationVsZone = nullIfBlank(data.entryLocationVsZone);
  const healthLevelAtEntry = nullIfBlank(data.healthLevelAtEntry);
  const exitReason = nullIfBlank(data.exitReason);
  const exitDiscipline = nullIfBlank(data.exitDiscipline);

  // Compute P&L/R if trade is closed with an exit price
  let realizedPnl: number | null = null;
  let rMultiple: number | null = null;
  const exitPriceNum =
    typeof data.exitPrice === "number" ? data.exitPrice : null;

  if (data.status === "CLOSED" && exitPriceNum) {
    realizedPnl = computePnl(
      data.direction,
      data.entryPrice,
      exitPriceNum,
      data.quantity,
      data.fees
    );
    if (stopLoss != null) {
      rMultiple = computeRMultiple(
        data.direction,
        data.entryPrice,
        exitPriceNum,
        stopLoss
      );
    }
  }
  const outcome = deriveOutcome(realizedPnl);

  // Snapshot immutability: only set setupSnapshot if not already present.
  const setupSnapshotPatch =
    existing.setupSnapshot == null
      ? parseSetupSnapshot(data.setupSnapshot)
      : existing.setupSnapshot;

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      setupId,
      symbol: data.symbol,
      direction: data.direction,
      status: data.status,
      entryDate: new Date(data.entryDate),
      exitDate: data.exitDate ? new Date(data.exitDate) : null,
      entryPrice: data.entryPrice,
      stopLoss,
      takeProfit,
      positionSize,
      entryReason: entryReason as
        | "ZONE_RETEST"
        | "BREAKOUT_CONFIRM"
        | "PULLBACK_ENTRY"
        | "STRUCTURE_CONTINUATION"
        | "MOMENTUM_CONFIRM"
        | "READY_ON_OPEN"
        | "READY_INTRADAY"
        | "LATE_CHASE"
        | null,
      entryLocationVsZone: entryLocationVsZone as
        | "IN_ZONE"
        | "ABOVE_ZONE"
        | "BELOW_ZONE"
        | null,
      healthLevelAtEntry: healthLevelAtEntry as SetupHealthLevel | null,
      healthScoreAtEntry,
      exitPrice: exitPriceNum,
      exitReason: exitReason as
        | "TAKE_PROFIT_HIT"
        | "STOP_LOSS_HIT"
        | "ZONE_INVALIDATED"
        | "STRUCTURE_BROKEN"
        | "HEALTH_DEGRADED_EOD"
        | "TIME_STOP"
        | "MANUAL_RULE_BASED_EXIT"
        | null,
      exitDiscipline: exitDiscipline as
        | "FOLLOWED_PLAN"
        | "EARLY_EXIT_RULE_BASED"
        | "EMOTIONAL_EXIT"
        | "RULE_VIOLATION"
        | null,
      quantity: data.quantity,
      fees: data.fees,
      playbook: DEFAULT_PLAYBOOK,
      realizedPnl,
      rMultiple,
      outcome,
      setupSnapshot: (setupSnapshotPatch as Prisma.InputJsonValue | null) ?? undefined,
      entryNote: data.entryNote || null,
      exitNote: data.exitNote || null,
      notes: data.notes || null,
    },
  });

  if (data.status === "CLOSED") {
    await writeSetupOutcomeFromTrade(tradeId);
  }

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  redirect("/trades");
}

// ─── Delete Trade ───

export async function deleteTrade(tradeId: string) {
  const session = await requireUser();

  const existing = await prisma.trade.findFirst({
    where: { id: tradeId, userId: session.userId },
  });

  if (!existing) {
    return { message: "Trade not found." };
  }

  await prisma.trade.delete({ where: { id: tradeId } });

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  redirect("/trades");
}

// ─── Manual Trade Health Checkpoint ───

export async function addTradeHealthCheckpoint(tradeId: string, formData: FormData) {
  const session = await requireUser();

  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId: session.userId },
    select: { id: true, status: true },
  });
  if (!trade) {
    redirect("/trades");
  }
  if (trade.status !== "OPEN") {
    revalidatePath(`/trades/${trade.id}`);
    redirect(`/trades/${trade.id}`);
  }

  const healthLevelRaw = String(formData.get("healthLevel") ?? "").trim();
  const allowedLevels = new Set(["HEALTHY", "WARNING", "AT_RISK", "DEAD"]);
  if (!allowedLevels.has(healthLevelRaw)) {
    revalidatePath(`/trades/${trade.id}`);
    redirect(`/trades/${trade.id}`);
  }

  const healthScoreRaw = String(formData.get("healthScore") ?? "").trim();
  let healthScore: number | null = null;
  if (healthScoreRaw.length > 0) {
    const n = Number(healthScoreRaw);
    if (Number.isFinite(n) && n >= 0 && n <= 100) {
      healthScore = Math.round(n);
    }
  }

  const priceVsZone = nullIfBlank(formData.get("priceVsZone"));
  const structureStatus = nullIfBlank(formData.get("structureStatus"));
  const recommendedAction = nullIfBlank(formData.get("recommendedAction"));

  const checklistJson = serializeReviewChecklistForDb(
    reviewChecklistFromFormData(formData)
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO trade_health_logs
      (trade_id, checked_at, health_level, health_score, price_vs_zone, structure_status, recommended_action, review_checklist)
     VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7::jsonb)`,
    trade.id,
    healthLevelRaw,
    healthScore,
    priceVsZone,
    structureStatus,
    recommendedAction,
    checklistJson
  );

  revalidatePath(`/trades/${trade.id}`);
  redirect(`/trades/${trade.id}`);
}
