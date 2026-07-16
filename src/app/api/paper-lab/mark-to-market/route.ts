import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import { markPositionsAndDetectExits } from "@/lib/paper-lab/engine/paper-trading-engine";
import { snapshotAllPortfolios } from "@/lib/paper-lab/portfolio/portfolio-service";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionDate = await getExpectedLatestSessionFromIndexBars(prisma);
  if (!sessionDate) return NextResponse.json({ error: "No session" }, { status: 503 });

  const symbols = await prisma.paperPosition.findMany({
    where: { status: { in: ["OPEN", "PARTIAL"] } },
    select: { symbol: true },
  });
  const marks = new Map<string, { low: number; high: number; close: number }>();
  const closeMarks = new Map<string, number>();

  for (const { symbol } of symbols) {
    const bar = await prisma.stockDailyBar.findFirst({
      where: { symbol: { symbol }, date: sessionDate },
    });
    if (bar) {
      marks.set(symbol, { low: bar.low, high: bar.high, close: bar.close });
      closeMarks.set(symbol, bar.close);
    }
  }

  const closed = await markPositionsAndDetectExits(prisma, sessionDate, marks);
  await snapshotAllPortfolios(prisma, sessionDate, closeMarks);

  return NextResponse.json({ sessionDate: sessionDate.toISOString().slice(0, 10), closed });
}

