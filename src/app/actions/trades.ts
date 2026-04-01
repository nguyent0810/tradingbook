"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TradeFormSchema, computePnl } from "@/lib/validations";

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

  // Compute P&L if trade is closed with an exit price
  let realizedPnl: number | null = null;
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
  }

  await prisma.trade.create({
    data: {
      userId: session.userId,
      symbol: data.symbol,
      direction: data.direction,
      status: data.status,
      entryDate: new Date(data.entryDate),
      exitDate: data.exitDate ? new Date(data.exitDate) : null,
      entryPrice: data.entryPrice,
      exitPrice: exitPriceNum,
      quantity: data.quantity,
      fees: data.fees,
      realizedPnl,
      notes: data.notes || null,
    },
  });

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

  // Compute P&L if trade is closed with an exit price
  let realizedPnl: number | null = null;
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
  }

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      symbol: data.symbol,
      direction: data.direction,
      status: data.status,
      entryDate: new Date(data.entryDate),
      exitDate: data.exitDate ? new Date(data.exitDate) : null,
      entryPrice: data.entryPrice,
      exitPrice: exitPriceNum,
      quantity: data.quantity,
      fees: data.fees,
      realizedPnl,
      notes: data.notes || null,
    },
  });

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
