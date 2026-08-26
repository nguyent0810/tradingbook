import {
  GAP,
  fmtNum,
  fmtPct,
  fmtVndCompact,
  fmtVndCompactSigned,
  priceToneVar,
} from "@/lib/format/vn";

import { healthShortLabel, healthTone } from "@/lib/terminal/labels";

/**
 * View model cho màn F4 Sổ lệnh.
 *
 * Nguyên tắc: mọi ô KPI phải truy được về hàng lệnh thật. Chỗ nào không có dữ
 * liệu (chưa đặt vốn tài khoản, chưa có lệnh đóng) thì để gap và nói rõ, không
 * điền số mặc định — sổ lệnh là nơi tệ nhất để đoán.
 */

export type F4Kpi = {
  key: string;
  value: string;
  sub: string;
  color: string;
};

export type F4OpenRow = {
  id: string;
  symbol: string;
  direction: string;
  quantity: number;
  entryPrice: number;
  markPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  unrealizedVnd: number | null;
  unrealizedPct: number | null;
  rMultiple: number | null;
  healthLabel: string;
  healthColor: string;
  holdingDays: number | null;
  /** Cảnh báo thật từ log sức khoẻ; rỗng khi không có. */
  alert: string;
  /** Ô giá không đại diện phiên chuẩn: thiếu bar, hoặc bar cũ hơn phiên chuẩn. */
  stale: boolean;
  /** Nêu rõ vì sao ô giá không tin được; `null` khi giá đúng phiên. */
  staleReason: string | null;
};

export type F4ClosedRow = {
  id: string;
  symbol: string;
  entryLabel: string;
  exitLabel: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnlVnd: number | null;
  rMultiple: number | null;
  reason: string;
  color: string;
};

export type F4RiskLogRow = {
  id: string;
  time: string;
  message: string;
  color: string;
};

export type F4ViewModel = {
  kpis: F4Kpi[];
  /** Đường vốn thực hiện, tích luỹ theo lệnh đã đóng (cũ → mới). */
  equityCurve: number[];
  equityCurveNote: string;
  openRows: F4OpenRow[];
  openEmptyReason: string | null;
  openSummary: string;
  closedRows: F4ClosedRow[];
  closedEmptyReason: string | null;
  riskLog: F4RiskLogRow[];
  riskLogEmptyReason: string | null;
};

export type TradeRecord = {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  entryDate: Date;
  exitDate: Date | null;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  realizedPnl: number | null;
  rMultiple: number | null;
  outcome: string | null;
  exitReason: string | null;
  healthLogs: {
    id: string;
    checkedAt: Date;
    healthLevel: string;
    recommendedAction: string | null;
  }[];
};

export type MarkBar = { close: number; date: Date };

export type F4ViewModelInput = {
  openTrades: TradeRecord[];
  closedTrades: TradeRecord[];
  /** Bar giá gần nhất theo mã; thiếu mã nào thì ô giá là gap. */
  latestCloseBySymbol: Map<string, MarkBar>;
  /**
   * Phiên chuẩn của thị trường (từ VNINDEX). Bar cũ hơn mốc này nghĩa là ô giá
   * và mọi phép tính lãi/lỗ trên hàng đó đang chạy trên dữ liệu cũ.
   */
  expectedSessionDate: Date | null;
  /** Vốn tài khoản từ Cài đặt (F5); `null` khi chưa đặt. */
  equityVnd: number | null;
  /** Trần rủi ro danh mục theo cấu hình, dạng thập phân (0.03 = 3%). */
  maxPortfolioRiskPct: number | null;
  now: Date;
};

/** Đơn giá lưu dạng nghìn ₫/cp — quy về đồng khi tính tiền. */
const K_VND = 1000;

/**
 * `Trade.realizedPnl` và `Trade.fees` cũng lưu theo **nghìn ₫**, không phải đồng:
 * `computePnl()` nhân trực tiếp `(giá ra − giá vào) × khối lượng` mà giá đang là
 * nghìn ₫/cp, và giao diện cũ in cột này kèm hậu tố "k ₫". Quên bước quy đổi này
 * sẽ làm mọi ô lãi/lỗ nhỏ đi 1.000 lần.
 */
function realizedVnd(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value * K_VND : null;
}

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/** Mốc ngày UTC — hai cột đều là ngày phiên, không phải dấu thời gian địa phương. */
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayLabel(date: Date | null): string {
  if (!date) return GAP;
  return date.toISOString().slice(0, 10);
}

function holdingDays(entry: Date, exit: Date | null, now: Date): number | null {
  const end = exit ?? now;
  const ms = end.getTime() - entry.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000);
}

/** Sụt giảm tối đa của đường vốn thực hiện (%), tính từ đỉnh trước đó. */
export function maxDrawdownPct(curve: readonly number[]): number | null {
  if (curve.length < 2) return null;
  let peak = curve[0];
  let worst = 0;
  for (const point of curve) {
    if (point > peak) peak = point;
    if (peak <= 0) continue;
    const drop = ((peak - point) / peak) * 100;
    if (drop > worst) worst = drop;
  }
  return worst;
}

function buildEquityCurve(closed: TradeRecord[], startingEquityVnd: number | null): number[] {
  const withExit = closed
    .filter((t) => t.exitDate != null && realizedVnd(t.realizedPnl) != null)
    .sort((a, b) => (a.exitDate as Date).getTime() - (b.exitDate as Date).getTime());
  if (withExit.length === 0) return [];

  // Không có vốn tài khoản thì vẫn vẽ được hình dạng tích luỹ lãi/lỗ, chỉ là
  // gốc quy ước bằng 0 — panel nói rõ điều đó trong ghi chú.
  let running = startingEquityVnd ?? 0;
  const curve = [running];
  for (const trade of withExit) {
    running += realizedVnd(trade.realizedPnl) as number;
    curve.push(running);
  }
  return curve;
}

function unrealized(trade: TradeRecord, mark: number | null) {
  if (mark == null) return { vnd: null, pct: null, r: null };
  const perShare = mark - trade.entryPrice;
  const vnd = perShare * K_VND * trade.quantity;
  const pct = trade.entryPrice > 0 ? (perShare / trade.entryPrice) * 100 : null;
  const risk = trade.stopLoss != null ? trade.entryPrice - trade.stopLoss : null;
  const r = risk != null && risk > 0 ? perShare / risk : null;
  return { vnd, pct, r };
}

/** Rủi ro còn phơi ra: tổng (giá vào − cắt lỗ) × khối lượng của các lệnh mở. */
export function openRiskVnd(openTrades: readonly TradeRecord[]): number | null {
  let total = 0;
  let counted = 0;
  for (const trade of openTrades) {
    if (trade.stopLoss == null) continue;
    const perShare = trade.entryPrice - trade.stopLoss;
    if (perShare <= 0) continue;
    total += perShare * K_VND * trade.quantity;
    counted += 1;
  }
  // Không lệnh nào có cắt lỗ hợp lệ ⇒ không tính được, để gap.
  return counted > 0 ? total : null;
}

function buildKpis(input: F4ViewModelInput, curve: number[]): F4Kpi[] {
  const { closedTrades, openTrades, equityVnd } = input;

  const closedWithPnl = closedTrades.filter((t) => realizedVnd(t.realizedPnl) != null);
  const startOfMonth = new Date(
    Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), 1)
  );
  const startOfYear = new Date(Date.UTC(input.now.getUTCFullYear(), 0, 1));

  const sumSince = (since: Date) =>
    closedWithPnl
      .filter((t) => t.exitDate != null && (t.exitDate as Date) >= since)
      .reduce((sum, t) => sum + (realizedVnd(t.realizedPnl) as number), 0);

  const monthPnl = closedWithPnl.length > 0 ? sumSince(startOfMonth) : null;
  const ytdPnl = closedWithPnl.length > 0 ? sumSince(startOfYear) : null;

  const wins = closedTrades.filter((t) => t.outcome === "WIN").length;
  const decided = closedTrades.filter((t) => t.outcome != null).length;
  const winRate = decided > 0 ? (wins / decided) * 100 : null;

  const rValues = closedTrades.map((t) => finite(t.rMultiple)).filter((r): r is number => r != null);
  const avgR = rValues.length > 0 ? rValues.reduce((a, b) => a + b, 0) / rValues.length : null;

  const drawdown = maxDrawdownPct(curve);
  const risk = openRiskVnd(openTrades);
  const riskPct = risk != null && equityVnd != null && equityVnd > 0 ? (risk / equityVnd) * 100 : null;
  const capPct = input.maxPortfolioRiskPct != null ? input.maxPortfolioRiskPct * 100 : null;

  return [
    {
      key: "VỐN TÀI KHOẢN",
      value: equityVnd != null ? fmtVndCompact(equityVnd) : GAP,
      sub: equityVnd != null ? "từ Cài đặt" : "chưa đặt ở F5",
      color: equityVnd != null ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
    {
      key: "LÃI/LỖ THÁNG",
      value: monthPnl != null ? fmtVndCompactSigned(monthPnl) : GAP,
      sub: "đã thực hiện",
      color: priceToneVar(monthPnl),
    },
    {
      key: "LÃI/LỖ NĂM",
      value: ytdPnl != null ? fmtVndCompactSigned(ytdPnl) : GAP,
      sub: "đã thực hiện",
      color: priceToneVar(ytdPnl),
    },
    {
      key: "TỶ LỆ THẮNG",
      value: winRate != null ? fmtPct(winRate, 1) : GAP,
      sub: decided > 0 ? `${fmtNum(decided, 0)} lệnh` : "chưa có lệnh đóng",
      color: winRate != null ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
    {
      key: "R BÌNH QUÂN",
      value: avgR != null ? fmtNum(avgR, 2) : GAP,
      sub: rValues.length > 0 ? `${fmtNum(rValues.length, 0)} lệnh có R` : "chưa có R",
      // Dùng chung quy ước: gap ⇒ mờ, 0 ⇒ vàng tham chiếu (hoà vốn KHÔNG phải lãi).
      color: priceToneVar(avgR),
    },
    {
      key: "SỤT GIẢM TỐI ĐA",
      value: drawdown != null ? `-${fmtPct(drawdown, 1)}` : GAP,
      sub: "đường vốn thực hiện",
      color: drawdown != null ? "var(--tm-down-soft)" : "var(--tm-text-faint)",
    },
    {
      key: "RỦI RO ĐANG MỞ",
      value: riskPct != null ? fmtPct(riskPct, 1) : risk != null ? fmtVndCompact(risk) : GAP,
      sub: capPct != null ? `trần ${fmtPct(capPct, 1)}` : "chưa đặt trần",
      color:
        riskPct != null && capPct != null && riskPct > capPct
          ? "var(--tm-down)"
          : riskPct != null
            ? "var(--tm-accent)"
            : "var(--tm-text-faint)",
    },
  ];
}

const HEALTH_LOG_TONE: Record<string, string> = {
  HEALTHY: "var(--tm-up)",
  WARNING: "var(--tm-ref)",
  AT_RISK: "var(--tm-accent)",
  DEAD: "var(--tm-down)",
};

/**
 * Sổ nhật ký rủi ro dựng từ **sự kiện có thật**: mốc đánh giá sức khoẻ lệnh và
 * mốc mở/đóng lệnh. Không có mục nào được sinh ra từ suy diễn.
 */
function buildRiskLog(input: F4ViewModelInput): F4RiskLogRow[] {
  type Event = { at: Date; row: Omit<F4RiskLogRow, "time"> };
  const events: Event[] = [];

  for (const trade of [...input.openTrades, ...input.closedTrades]) {
    for (const log of trade.healthLogs) {
      events.push({
        at: log.checkedAt,
        row: {
          id: log.id,
          message: `${trade.symbol} · sức khoẻ ${healthShortLabel(log.healthLevel)}${
            log.recommendedAction ? ` — ${log.recommendedAction}` : ""
          }`,
          color: HEALTH_LOG_TONE[log.healthLevel] ?? "var(--tm-text-mute)",
        },
      });
    }
    events.push({
      at: trade.entryDate,
      row: {
        id: `${trade.id}:open`,
        message: `${trade.symbol} · mở ${fmtNum(trade.quantity, 0)} cp @ ${fmtNum(trade.entryPrice, 2)}`,
        color: "var(--tm-text-mute)",
      },
    });
    if (trade.exitDate) {
      events.push({
        at: trade.exitDate,
        row: {
          id: `${trade.id}:close`,
          message: `${trade.symbol} · đóng ${
            realizedVnd(trade.realizedPnl) != null
              ? fmtVndCompactSigned(realizedVnd(trade.realizedPnl) as number)
              : GAP
          }${finite(trade.rMultiple) != null ? ` (${fmtNum(trade.rMultiple as number, 2)}R)` : ""}`,
          color: priceToneVar(trade.realizedPnl),
        },
      });
    }
  }

  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 30)
    .map((e) => ({ ...e.row, time: dayLabel(e.at) }));
}

export function buildF4ViewModel(input: F4ViewModelInput): F4ViewModel {
  const equityCurve = buildEquityCurve(input.closedTrades, input.equityVnd);

  const openRows: F4OpenRow[] = input.openTrades.map((trade) => {
    const bar = input.latestCloseBySymbol.get(trade.symbol) ?? null;
    const mark = bar ? finite(bar.close) : null;
    const u = unrealized(trade, mark);
    const latestLog = trade.healthLogs[0] ?? null;
    const staleReason =
      mark == null
        ? "Chưa có bar giá cho mã này — không tính được lãi/lỗ."
        : bar != null &&
            input.expectedSessionDate != null &&
            utcDay(bar.date) < utcDay(input.expectedSessionDate)
          ? `Giá đang lấy từ phiên ${dayLabel(bar.date)}, cũ hơn phiên chuẩn ${dayLabel(
              input.expectedSessionDate
            )}.`
          : null;
    return {
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction === "LONG" ? "MUA" : "BÁN",
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      markPrice: mark,
      stopLoss: finite(trade.stopLoss),
      takeProfit: finite(trade.takeProfit),
      unrealizedVnd: u.vnd,
      unrealizedPct: u.pct,
      rMultiple: u.r,
      healthLabel: healthShortLabel(latestLog?.healthLevel ?? null),
      healthColor: healthTone(latestLog?.healthLevel ?? null),
      holdingDays: holdingDays(trade.entryDate, null, input.now),
      alert: latestLog?.recommendedAction ?? "",
      stale: staleReason != null,
      staleReason,
    };
  });

  const closedRows: F4ClosedRow[] = input.closedTrades.map((trade) => ({
    id: trade.id,
    symbol: trade.symbol,
    entryLabel: dayLabel(trade.entryDate),
    exitLabel: dayLabel(trade.exitDate),
    quantity: trade.quantity,
    entryPrice: trade.entryPrice,
    exitPrice: finite(trade.exitPrice),
    realizedPnlVnd: realizedVnd(trade.realizedPnl),
    rMultiple: finite(trade.rMultiple),
    reason: trade.exitReason ?? trade.outcome ?? GAP,
    color: priceToneVar(trade.realizedPnl),
  }));

  const risk = openRiskVnd(input.openTrades);
  const riskPct =
    risk != null && input.equityVnd != null && input.equityVnd > 0
      ? (risk / input.equityVnd) * 100
      : null;

  const riskLog = buildRiskLog(input);

  return {
    kpis: buildKpis(input, equityCurve),
    equityCurve,
    equityCurveNote:
      input.equityVnd != null
        ? "Tích luỹ lãi/lỗ đã thực hiện, gốc là vốn tài khoản trong Cài đặt."
        : "Tích luỹ lãi/lỗ đã thực hiện, gốc quy ước bằng 0 vì chưa đặt vốn tài khoản.",
    openRows,
    openEmptyReason:
      openRows.length === 0
        ? "Sổ lệnh chưa có vị thế nào đang mở. Ghi lệnh từ màn Thiết lập (F2) hoặc ghi lệnh tay."
        : null,
    openSummary:
      openRows.length === 0
        ? ""
        : `· ${fmtNum(openRows.length, 0)} VỊ THẾ${
            riskPct != null ? ` · RỦI RO ${fmtPct(riskPct, 1)} NAV` : ""
          }`,
    closedRows,
    closedEmptyReason:
      closedRows.length === 0 ? "Chưa có lệnh nào được đóng trong sổ." : null,
    riskLog,
    riskLogEmptyReason:
      riskLog.length === 0
        ? "Chưa có sự kiện nào: sổ nhật ký ghi lại mốc mở/đóng lệnh và mốc đánh giá sức khoẻ."
        : null,
  };
}
