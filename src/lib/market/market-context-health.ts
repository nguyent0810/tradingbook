import type { PrismaClient } from "@/generated/prisma/client";
import { getExpectedLatestSessionFromIndexBars } from "@/lib/scanner/expected-session";
import { isoDayUtc } from "@/lib/market/session-date";

export type MarketContextHealthIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
};

export type MarketContextHealthReport = {
  sessionDate: string | null;
  expectedSession: string | null;
  sessionAligned: boolean;
  foreignTradeDaily: {
    rowCount: number;
    okCount: number;
    coveragePct: number | null;
  };
  marketContextDaily: {
    exists: boolean;
    foreignNetValue1d: number | null;
    foreignNetValue5d: number | null;
    foreignNetValue10d: number | null;
    foreignSymbolsOk: number | null;
    foreignSymbolsTotal: number | null;
  };
  symbolMarketContextDaily: {
    count: number;
  };
  issues: MarketContextHealthIssue[];
};

export async function buildMarketContextHealthReport(
  prisma: PrismaClient,
  sessionDateArg?: string
): Promise<MarketContextHealthReport> {
  const expected = await getExpectedLatestSessionFromIndexBars(prisma);
  const expectedSession = expected ? isoDayUtc(expected) : null;
  const sessionDate = sessionDateArg ?? expectedSession;

  const issues: MarketContextHealthIssue[] = [];

  if (!expectedSession) {
    issues.push({
      code: "benchmark_missing",
      severity: "error",
      message: "No VNINDEX session — import index bars before market context.",
    });
  }

  if (sessionDate && expectedSession && sessionDate !== expectedSession) {
    issues.push({
      code: "session_mismatch",
      severity: "error",
      message: `Requested session ${sessionDate} != expected VNINDEX session ${expectedSession}.`,
    });
  }

  const sessionAligned = Boolean(
    sessionDate && expectedSession && sessionDate === expectedSession
  );

  let foreignRowCount = 0;
  let foreignOkCount = 0;
  if (sessionDate) {
    const session = new Date(`${sessionDate}T00:00:00.000Z`);
    foreignRowCount = await prisma.foreignTradeDaily.count({
      where: { sessionDate: session },
    });
    foreignOkCount = await prisma.foreignTradeDaily.count({
      where: { sessionDate: session, dataQuality: "OK" },
    });
  }

  const coveragePct =
    foreignRowCount > 0 ? foreignOkCount / foreignRowCount : null;

  if (sessionDate && foreignRowCount === 0) {
    issues.push({
      code: "foreign_rows_missing",
      severity: "warning",
      message: `No foreign_trade_daily rows for session ${sessionDate}.`,
    });
  }

  let marketRow: {
    foreignNetValue1d: number | null;
    foreignNetValue5d: number | null;
    foreignNetValue10d: number | null;
    foreignSymbolsOk: number;
    foreignSymbolsTotal: number;
  } | null = null;

  let symbolContextCount = 0;

  if (sessionDate) {
    const session = new Date(`${sessionDate}T00:00:00.000Z`);
    marketRow = await prisma.marketContextDaily.findUnique({
      where: { sessionDate: session },
      select: {
        foreignNetValue1d: true,
        foreignNetValue5d: true,
        foreignNetValue10d: true,
        foreignSymbolsOk: true,
        foreignSymbolsTotal: true,
      },
    });
    symbolContextCount = await prisma.symbolMarketContextDaily.count({
      where: { sessionDate: session },
    });

    if (!marketRow) {
      issues.push({
        code: "market_context_missing",
        severity: "warning",
        message: `No market_context_daily row for session ${sessionDate}.`,
      });
    }
  }

  return {
    sessionDate,
    expectedSession,
    sessionAligned,
    foreignTradeDaily: {
      rowCount: foreignRowCount,
      okCount: foreignOkCount,
      coveragePct,
    },
    marketContextDaily: {
      exists: marketRow != null,
      foreignNetValue1d: marketRow?.foreignNetValue1d ?? null,
      foreignNetValue5d: marketRow?.foreignNetValue5d ?? null,
      foreignNetValue10d: marketRow?.foreignNetValue10d ?? null,
      foreignSymbolsOk: marketRow?.foreignSymbolsOk ?? null,
      foreignSymbolsTotal: marketRow?.foreignSymbolsTotal ?? null,
    },
    symbolMarketContextDaily: {
      count: symbolContextCount,
    },
    issues,
  };
}
