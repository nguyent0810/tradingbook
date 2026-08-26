import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadOpenPositionMarks } from "@/lib/trades/position-health";
import { getTradingAccountEquityVnd } from "@/lib/trading-account-risk-config";
import { buildF4ViewModel, type TradeRecord } from "@/lib/trades/terminal/f4-view-model";
import { F4Screen } from "@/components/book/terminal/f4-screen";
import { F4Skeleton } from "@/components/book/terminal/f4-skeleton";
import "@/styles/terminal-f4.css";

export const metadata: Metadata = {
  title: "F4 Sổ lệnh — TradeLog VN Terminal",
  description: "Lệnh đang mở, lịch sử lệnh đã đóng và sổ nhật ký rủi ro.",
};

async function BookContent() {
  const session = await getSession();
  if (!session) redirect("/login");

  const errors: string[] = [];

  const tradesResult = await prisma.trade
    .findMany({
      where: { userId: session.userId },
      orderBy: { entryDate: "desc" },
      include: { healthLogs: { orderBy: { checkedAt: "desc" }, take: 5 } },
    })
    .then((rows) => ({ rows, error: null as string | null }))
    .catch((e) => {
      console.error("[book] trade query failed:", e);
      return { rows: [], error: `prisma.trade.findMany → ${String(e)}` };
    });
  if (tradesResult.error) errors.push(tradesResult.error);

  const trades = tradesResult.rows;
  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  const [marks, equityVnd] = await Promise.all([
    loadOpenPositionMarks(prisma, openTrades.map((t) => t.symbol)).catch((e) => {
      console.error("[book] position marks failed:", e);
      errors.push(`loadOpenPositionMarks → ${String(e)}`);
      return {
        latestCloseBySymbol: new Map<string, { close: number; date: Date }>(),
        expectedSessionDate: null,
        benchmarkLoadError: `loadOpenPositionMarks → ${String(e)}`,
        barsLoadError: `loadOpenPositionMarks → ${String(e)}`,
      };
    }),
    getTradingAccountEquityVnd(session.userId).catch((e) => {
      console.error("[book] equity lookup failed:", e);
      errors.push(`getTradingAccountEquityVnd → ${String(e)}`);
      return null;
    }),
  ]);

  // `loadOpenPositionMarks()` tự bắt lỗi bên trong và không bao giờ ném, nên hai
  // trường này là đường DUY NHẤT để biết truy vấn giá hoặc phiên chuẩn đã hỏng.
  // Bỏ qua chúng thì F4 sẽ mất mốc phiên (hết đánh dấu được dữ liệu cũ) mà
  // không có dòng bằng chứng nào. Chúng mang nguyên văn exception, không phải
  // một câu mô tả do màn tự đặt ra.
  if (marks.benchmarkLoadError) errors.push(marks.benchmarkLoadError);
  if (marks.barsLoadError) errors.push(marks.barsLoadError);

  const toRecord = (t: (typeof trades)[number]): TradeRecord => ({
    id: t.id,
    symbol: t.symbol,
    direction: t.direction,
    status: t.status,
    entryDate: t.entryDate,
    exitDate: t.exitDate,
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    quantity: t.quantity,
    stopLoss: t.stopLoss,
    takeProfit: t.takeProfit,
    realizedPnl: t.realizedPnl,
    rMultiple: t.rMultiple,
    outcome: t.outcome,
    exitReason: t.exitReason,
    healthLogs: t.healthLogs.map((log) => ({
      id: log.id,
      checkedAt: log.checkedAt,
      healthLevel: log.healthLevel,
      recommendedAction: log.recommendedAction,
    })),
  });

  const model = buildF4ViewModel({
    openTrades: openTrades.map(toRecord),
    closedTrades: closedTrades.map(toRecord),
    latestCloseBySymbol: marks.latestCloseBySymbol,
    expectedSessionDate: marks.expectedSessionDate,
    equityVnd,
    // Hệ thống chưa có tham số "trần rủi ro danh mục" — `computePositionSizing`
    // chỉ có trần **phơi nhiễm** (giá trị vị thế), không phải trần rủi ro. Ghi
    // một con số vào đây là bịa ra một hạn mức người dùng chưa từng đặt.
    maxPortfolioRiskPct: null,
    now: new Date(),
  });

  const exitNotesById: Record<string, string> = {};
  for (const trade of closedTrades) {
    if (trade.exitNote) exitNotesById[trade.id] = trade.exitNote;
  }

  return (
    <F4Screen
      model={model}
      loadError={errors.length > 0 ? errors.join("\n") : null}
      exitNotesById={exitNotesById}
    />
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<F4Skeleton />}>
      <BookContent />
    </Suspense>
  );
}
