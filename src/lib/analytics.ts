import { Trade } from "@/generated/prisma/client";

export type AdvancedMetrics = {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  averageWinner: number;
  averageLoser: number;
  largestWinner: number;
  largestLoser: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
};

export type EquityDataPoint = {
  date: string;
  pnl: number;
  cumulativePnl: number;
};

export type StrategyPerformance = {
  strategy: string;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
};

export function computeAdvancedMetrics(trades: Trade[]): AdvancedMetrics {
  const closedTrades = trades.filter((t) => t.status === "CLOSED" && t.realizedPnl !== null);
  const totalTrades = closedTrades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      totalPnl: 0,
      averageWinner: 0,
      averageLoser: 0,
      largestWinner: 0,
      largestLoser: 0,
      profitFactor: 0,
      expectancy: 0,
      maxDrawdown: 0,
    };
  }

  let totalPnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let largestWinner = 0;
  let largestLoser = 0;

  for (const t of closedTrades) {
    const pnl = t.realizedPnl!;
    totalPnl += pnl;

    if (pnl > 0) {
      winningTrades++;
      grossProfit += pnl;
      if (pnl > largestWinner) largestWinner = pnl;
    } else if (pnl < 0) {
      losingTrades++;
      grossLoss += Math.abs(pnl);
      if (pnl < largestLoser) largestLoser = pnl;
    }
  }

  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;
  const averageWinner = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const averageLoser = losingTrades > 0 ? grossLoss / losingTrades : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  
  // Expectancy = (Win % * Average Win) - (Loss % * Average Loss absolute value)
  const lossRate = 1 - winRate;
  const expectancy = (winRate * averageWinner) - (lossRate * averageLoser);

  // Sorting trades chronologically by exitDate (fallback to entryDate)
  const sortedChronological = [...closedTrades].sort((a, b) => {
    const timeA = a.exitDate ? a.exitDate.getTime() : a.entryDate.getTime();
    const timeB = b.exitDate ? b.exitDate.getTime() : b.entryDate.getTime();
    return timeA - timeB;
  });

  // Calculate Cumulative P&L and Max Drawdown
  let runningPnl = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const t of sortedChronological) {
    runningPnl += t.realizedPnl!;
    if (runningPnl > peak) {
      peak = runningPnl;
    }
    const currentDrawdown = peak - runningPnl;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }
  }

  return {
    totalTrades,
    winRate: parseFloat((winRate * 100).toFixed(2)),
    totalPnl,
    averageWinner,
    averageLoser,
    largestWinner,
    largestLoser,
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    maxDrawdown,
  };
}

export function computeEquityCurve(trades: Trade[]): EquityDataPoint[] {
  const closedTrades = trades.filter((t) => t.status === "CLOSED" && t.realizedPnl !== null);
  const sortedChronological = closedTrades.sort((a, b) => {
    const timeA = a.exitDate ? a.exitDate.getTime() : a.entryDate.getTime();
    const timeB = b.exitDate ? b.exitDate.getTime() : b.entryDate.getTime();
    return timeA - timeB;
  });

  let cumulativePnl = 0;
  return sortedChronological.map((t) => {
    cumulativePnl += t.realizedPnl!;
    const displayDate = typeof window === 'undefined' ? 
       (t.exitDate || t.entryDate).toISOString().split('T')[0] : 
       (t.exitDate || t.entryDate).toLocaleDateString();

    return {
      date: displayDate,
      pnl: t.realizedPnl!,
      cumulativePnl: parseFloat(cumulativePnl.toFixed(2)),
    };
  });
}

export function computeStrategyPerformance(trades: Trade[]): StrategyPerformance[] {
  const closedTrades = trades.filter((t) => t.status === "CLOSED" && t.realizedPnl !== null);
  
  const groups: Record<string, { count: number; wins: number; pnl: number }> = {};

  for (const t of closedTrades) {
    const strategy = t.strategy?.trim() || "Uncategorized";
    if (!groups[strategy]) {
      groups[strategy] = { count: 0, wins: 0, pnl: 0 };
    }
    groups[strategy].count++;
    groups[strategy].pnl += t.realizedPnl!;
    if (t.realizedPnl! > 0) {
      groups[strategy].wins++;
    }
  }

  return Object.keys(groups).map((strategy) => {
    const g = groups[strategy];
    return {
      strategy,
      totalTrades: g.count,
      winRate: parseFloat(((g.wins / g.count) * 100).toFixed(2)),
      totalPnl: parseFloat(g.pnl.toFixed(2)),
    };
  }).sort((a, b) => b.totalPnl - a.totalPnl);
}
