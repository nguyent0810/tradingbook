import "server-only";

import { prisma } from "@/lib/prisma";
import { SetupLifecycleStatus } from "@/generated/prisma/client";

/**
 * Băng giá chạy dưới thanh trên. Chỉ hiện **dữ liệu thật** từ bar đã lưu:
 * không sinh giá giả, không nội suy. Mã nào không đủ 2 phiên để tính biến động
 * thì bị loại khỏi băng chứ không hiện 0%.
 */
export type TickerItem = {
  symbol: string;
  close: number;
  changePct: number | null;
};

const INDEX_SYMBOL = "VNINDEX";
const MAX_EQUITY_TICKS = 15;

/** Biến động % giữa hai phiên gần nhất; null khi chưa đủ 2 phiên. */
function changePct(bars: readonly { close: number }[]): number | null {
  if (bars.length < 2) return null;
  const [latest, prev] = bars;
  if (!Number.isFinite(latest.close) || !Number.isFinite(prev.close) || prev.close === 0) {
    return null;
  }
  return ((latest.close - prev.close) / prev.close) * 100;
}

async function loadIndexTick(): Promise<TickerItem | null> {
  const bars = await prisma.indexDailyBar.findMany({
    where: { symbol: INDEX_SYMBOL },
    orderBy: { date: "desc" },
    take: 2,
    select: { close: true },
  });
  if (bars.length === 0) return null;
  return { symbol: INDEX_SYMBOL, close: bars[0].close, changePct: changePct(bars) };
}

/**
 * Mã đưa lên băng giá: danh mục theo dõi đang hoạt động, đủ để lấp băng.
 * Đây là những mã người dùng thực sự quan tâm, không phải danh sách trang trí.
 */
async function loadWatchedSymbolIds(): Promise<{ id: string; symbol: string }[]> {
  const items = await prisma.setupWatchItem.findMany({
    where: {
      lifecycleStatus: {
        in: [
          SetupLifecycleStatus.NEW,
          SetupLifecycleStatus.WATCHING,
          SetupLifecycleStatus.READY,
        ],
      },
    },
    orderBy: [{ lifecycleStatus: "asc" }, { updatedAt: "desc" }],
    take: MAX_EQUITY_TICKS,
    select: { symbolId: true, symbol: { select: { symbol: true } } },
  });

  const seen = new Set<string>();
  const out: { id: string; symbol: string }[] = [];
  for (const item of items) {
    if (seen.has(item.symbolId)) continue;
    seen.add(item.symbolId);
    out.push({ id: item.symbolId, symbol: item.symbol.symbol });
  }
  return out;
}

async function loadEquityTicks(): Promise<TickerItem[]> {
  const symbols = await loadWatchedSymbolIds();
  if (symbols.length === 0) return [];

  const ticks = await Promise.all(
    symbols.map(async ({ id, symbol }) => {
      const bars = await prisma.stockDailyBar.findMany({
        where: { symbolId: id },
        orderBy: { date: "desc" },
        take: 2,
        select: { close: true },
      });
      if (bars.length === 0) return null;
      return { symbol, close: bars[0].close, changePct: changePct(bars) };
    })
  );

  return ticks.filter((t): t is TickerItem => t !== null);
}

/**
 * Nội dung băng giá. Không bao giờ ném lỗi: băng giá là trang trí thông tin,
 * hỏng dữ liệu thì băng rỗng chứ không được làm sập shell.
 */
export async function loadTickerTape(): Promise<TickerItem[]> {
  const [index, equities] = await Promise.allSettled([loadIndexTick(), loadEquityTicks()]);

  const items: TickerItem[] = [];
  if (index.status === "fulfilled" && index.value) items.push(index.value);
  if (equities.status === "fulfilled") items.push(...equities.value);
  return items;
}
