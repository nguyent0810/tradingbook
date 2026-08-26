import {
  GAP,
  fmtNum,
  fmtPct,
  fmtSigned,
  fmtVndCompact,
  priceToneVar,
  semanticTone,
} from "@/lib/format/vn";
import { healthShortLabel, healthTone, rsTone } from "@/lib/terminal/labels";

/**
 * View model cho màn F7 Chi tiết mã.
 *
 * Nguyên tắc như các màn khác: ô nào không có nguồn dữ liệu trong hệ thống thì
 * hiện `—`, và panel nào **hoàn toàn** không có nguồn thì không dựng (xem ghi
 * chú ở `TIN & SỰ KIỆN` trong page).
 */

export type Bar = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type F7Candle = {
  /** Toạ độ đã chuẩn hoá về hệ 0..1 để component tự nhân theo khung vẽ. */
  x: number;
  highY: number;
  lowY: number;
  bodyTopY: number;
  bodyHeight: number;
  volumeHeight: number;
  rising: boolean;
};

export type F7QuoteCell = { key: string; value: string; color: string };
export type F7TechRow = { key: string; value: string; status: string; color: string };
export type F7HistoryRow = { time: string; message: string; color: string };

export type F7ViewModel = {
  symbol: string;
  close: number | null;
  changePct: number | null;
  tier: string | null;
  rankScore: number | null;
  /** Id ứng viên Cổng 2 mới nhất — có thì mới ghi lệnh được từ màn này. */
  setupId: string | null;
  zone: { low: number; high: number } | null;
  stop: number | null;
  candles: F7Candle[];
  /** Đường MA20 theo cùng hệ toạ độ 0..1; điểm chưa đủ dữ liệu là `null`. */
  ma20: (number | null)[];
  zoneBand: { topY: number; height: number } | null;
  stopY: number | null;
  chartEmptyReason: string | null;
  quote: F7QuoteCell[];
  tech: F7TechRow[];
  history: F7HistoryRow[];
  historyEmptyReason: string | null;
};

/** Biên độ dao động trong phiên theo sàn — quy ước bảng giá Việt Nam. */
export function priceBandPct(exchange: string | null): number | null {
  switch ((exchange ?? "").toUpperCase()) {
    case "HOSE":
      return 7;
    case "HNX":
      return 10;
    case "UPCOM":
      return 15;
    default:
      // Không biết sàn thì không suy ra biên độ — trần/sàn để gap.
      return null;
  }
}

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/** Trung bình động đơn giản; phần tử chưa đủ cửa sổ là `null`. */
export function sma(values: readonly number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

/** RSI Wilder 14 phiên trên giá đóng cửa; `null` khi chưa đủ dữ liệu. */
export function rsi(closes: readonly number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, delta)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -delta)) / period;
  }
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** ATR Wilder 14 phiên, trả theo % của giá đóng cửa cuối; `null` khi thiếu dữ liệu. */
export function atrPct(bars: readonly Bar[], period = 14): number | null {
  if (bars.length <= period) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const prevClose = bars[i - 1].close;
    trueRanges.push(
      Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - prevClose),
        Math.abs(bars[i].low - prevClose)
      )
    );
  }
  if (trueRanges.length < period) return null;
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i += 1) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  const lastClose = bars[bars.length - 1].close;
  return lastClose > 0 ? (atr / lastClose) * 100 : null;
}

export type F7ViewModelInput = {
  symbol: string;
  exchange: string | null;
  /** Nến ngày theo thứ tự thời gian tăng dần. */
  bars: Bar[];
  /** Ứng viên Cổng 2 mới nhất của mã (nếu có). */
  candidate: {
    id: string;
    quality: string;
    rankScore: number;
    pullbackZoneLow: number;
    pullbackZoneHigh: number;
    stopLevel: number;
    healthLevel: string | null;
    healthScore: number | null;
    baseSessions: number | null;
  } | null;
  /** Giá trị khớp bình quân 20 phiên (đồng) và tỉ lệ khối lượng so với MA20. */
  avgValue20Vnd: number | null;
  volumeRatioMa20: number | null;
  /** Khối ngoại mua ròng phiên gần nhất (đồng). */
  foreignNetVnd: number | null;
  /** RS20 vs VNINDEX (điểm phần trăm). */
  rs20SpreadPct: number | null;
  /** Lịch sử mã xuất hiện trong các lần quét. */
  scanHistory: {
    sessionDate: Date;
    quality: string;
    rankScore: number;
  }[];
};

const CHART_VOLUME_FRACTION = 0.22;

function buildCandles(
  bars: Bar[],
  /**
   * Mức giá bắt buộc phải nằm trong khung: vùng mua và cắt lỗ. Nếu chỉ lấy
   * min/max của nến, một cắt lỗ nằm dưới đáy 64 phiên sẽ bị cắt mất hoặc rơi
   * xuống dải khối lượng — người đọc thấy vạch cắt lỗ ở sai chỗ.
   */
  extraLevels: number[]
): {
  candles: F7Candle[];
  ma20: (number | null)[];
  priceMin: number;
  priceMax: number;
} {
  const finiteExtras = extraLevels.filter((v) => Number.isFinite(v));
  const priceMin = Math.min(...bars.map((b) => b.low), ...finiteExtras);
  const priceMax = Math.max(...bars.map((b) => b.high), ...finiteExtras);
  const range = priceMax - priceMin || 1;
  const maxVolume = Math.max(...bars.map((b) => b.volume), 1);
  const priceArea = 1 - CHART_VOLUME_FRACTION;

  // y = 0 ở đỉnh khung. Vùng giá chiếm phần trên, khối lượng chiếm dải dưới.
  const py = (v: number) => ((priceMax - v) / range) * priceArea;

  const candles = bars.map((bar, i) => {
    const bodyTop = Math.max(bar.open, bar.close);
    const bodyBottom = Math.min(bar.open, bar.close);
    return {
      x: bars.length > 1 ? i / (bars.length - 1) : 0.5,
      highY: py(bar.high),
      lowY: py(bar.low),
      bodyTopY: py(bodyTop),
      bodyHeight: Math.max(py(bodyBottom) - py(bodyTop), 0.002),
      volumeHeight: (bar.volume / maxVolume) * CHART_VOLUME_FRACTION,
      rising: bar.close >= bar.open,
    };
  });

  const maSeries = sma(bars.map((b) => b.close), 20);
  const ma20 = maSeries.map((v) => (v == null ? null : py(v)));

  return { candles, ma20, priceMin, priceMax };
}

export function buildF7ViewModel(input: F7ViewModelInput): F7ViewModel {
  const { bars, candidate } = input;
  const last = bars.length > 0 ? bars[bars.length - 1] : null;
  const prev = bars.length > 1 ? bars[bars.length - 2] : null;

  const close = last ? finite(last.close) : null;
  const changePct =
    last && prev && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : null;

  const zone = candidate
    ? { low: candidate.pullbackZoneLow, high: candidate.pullbackZoneHigh }
    : null;
  const stop = candidate ? finite(candidate.stopLevel) : null;

  // Thang đo bao luôn vùng mua và cắt lỗ để ba thứ nằm đúng vị trí tương đối.
  const extraLevels = [zone?.low, zone?.high, stop].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  const chart = bars.length >= 2 ? buildCandles(bars, extraLevels) : null;
  const priceMin = chart?.priceMin ?? 0;
  const priceMax = chart?.priceMax ?? 1;
  const range = priceMax - priceMin || 1;
  const priceArea = 1 - CHART_VOLUME_FRACTION;
  const py = (v: number) => ((priceMax - v) / range) * priceArea;

  // Chỉ dựng dải vùng mua khi có cả vùng mua lẫn khung vẽ.
  const band =
    zone != null && chart != null
      ? { topY: py(zone.high), height: Math.max(py(zone.low) - py(zone.high), 0.002) }
      : null;

  // ── Bảng giá ─────────────────────────────────────────────────────────────
  const bandPct = priceBandPct(input.exchange);
  const ref = prev ? prev.close : null;
  const ceiling = ref != null && bandPct != null ? ref * (1 + bandPct / 100) : null;
  const floor = ref != null && bandPct != null ? ref * (1 - bandPct / 100) : null;
  const turnoverVnd = last ? last.close * 1000 * last.volume : null;

  const quote: F7QuoteCell[] = [
    {
      key: "MỞ CỬA",
      value: fmtNum(last?.open, 2),
      color: semanticTone(last?.open, "var(--tm-text-value)"),
    },
    { key: "CAO NHẤT", value: fmtNum(last?.high, 2), color: semanticTone(last?.high, "var(--tm-up)") },
    { key: "THẤP NHẤT", value: fmtNum(last?.low, 2), color: semanticTone(last?.low, "var(--tm-down)") },
    { key: "THAM CHIẾU", value: fmtNum(ref, 2), color: semanticTone(ref, "var(--tm-ref)") },
    {
      key: "TRẦN",
      value: fmtNum(ceiling, 2),
      color: semanticTone(ceiling, "var(--tm-ceil)"),
    },
    {
      key: "SÀN",
      value: fmtNum(floor, 2),
      color: semanticTone(floor, "var(--tm-floor)"),
    },
    {
      key: "KL KHỚP",
      value: last ? fmtNum(last.volume, 0) : GAP,
      color: semanticTone(last?.volume, "var(--tm-text-value)"),
    },
    {
      key: "GTGD",
      value: turnoverVnd != null ? fmtVndCompact(turnoverVnd) : GAP,
      color: semanticTone(turnoverVnd, "var(--tm-text-value)"),
    },
    {
      key: "GTGD 20N",
      value: input.avgValue20Vnd != null ? fmtVndCompact(input.avgValue20Vnd) : GAP,
      color: input.avgValue20Vnd != null ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
    {
      key: "KHỐI NGOẠI",
      value: input.foreignNetVnd != null ? fmtVndCompact(input.foreignNetVnd) : GAP,
      // Ròng bằng 0 là CÂN BẰNG, không phải mua ròng ⇒ vàng tham chiếu.
      color: priceToneVar(input.foreignNetVnd),
    },
    {
      // Ngày của bar đang hiển thị — người đọc phải biết bảng giá này là phiên nào.
      key: "PHIÊN",
      value: last ? last.date.toISOString().slice(0, 10) : GAP,
      color: last ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
    {
      key: "SỨC KHOẺ",
      value: candidate
        ? `${healthShortLabel(candidate.healthLevel)}${
            candidate.healthScore != null ? ` ${fmtNum(candidate.healthScore, 0)}` : ""
          }`
        : GAP,
      color: candidate ? healthTone(candidate.healthLevel) : "var(--tm-text-faint)",
    },
  ];

  // ── Chỉ báo kỹ thuật ─────────────────────────────────────────────────────
  const closes = bars.map((b) => b.close);
  const ma = (window: number) => {
    const series = sma(closes, window);
    return series.length > 0 ? series[series.length - 1] : null;
  };
  const maRow = (label: string, window: number): F7TechRow => {
    const value = ma(window);
    const above = value != null && close != null ? close >= value : null;
    return {
      key: label,
      value: fmtNum(value, 2),
      status: above == null ? GAP : above ? "TRÊN" : "DƯỚI",
      color:
        above == null ? "var(--tm-text-faint)" : above ? "var(--tm-up)" : "var(--tm-down)",
    };
  };

  const rsiValue = rsi(closes);
  const atr = atrPct(bars);

  const tech: F7TechRow[] = [
    maRow("MA20", 20),
    maRow("MA50", 50),
    maRow("MA200", 200),
    {
      key: "RSI14",
      value: fmtNum(rsiValue, 1),
      status:
        rsiValue == null ? GAP : rsiValue >= 70 ? "QUÁ MUA" : rsiValue <= 30 ? "QUÁ BÁN" : "TRUNG TÍNH",
      color:
        rsiValue == null
          ? "var(--tm-text-faint)"
          : rsiValue >= 70 || rsiValue <= 30
            ? "var(--tm-accent)"
            : "var(--tm-ref)",
    },
    {
      key: "ATR14",
      value: atr != null ? fmtPct(atr, 1) : GAP,
      status: atr == null ? GAP : atr <= 4.5 ? "TRONG NGƯỠNG" : "CAO",
      color:
        atr == null ? "var(--tm-text-faint)" : atr <= 4.5 ? "var(--tm-up)" : "var(--tm-down)",
    },
    {
      key: "RS20 vs VNINDEX",
      value: input.rs20SpreadPct != null ? fmtSigned(input.rs20SpreadPct, 1) : GAP,
      status:
        input.rs20SpreadPct == null
          ? GAP
          : input.rs20SpreadPct >= 6
            ? "ĐẠT NGƯỠNG"
            : "DƯỚI NGƯỠNG",
      color: rsTone(input.rs20SpreadPct),
    },
    {
      key: "KL vs B/Q 20N",
      value:
        input.volumeRatioMa20 != null ? fmtPct((input.volumeRatioMa20 - 1) * 100, 0) : GAP,
      status:
        input.volumeRatioMa20 == null ? GAP : input.volumeRatioMa20 < 1 ? "NÉN" : "BUNG",
      color:
        input.volumeRatioMa20 == null
          ? "var(--tm-text-faint)"
          : input.volumeRatioMa20 < 1
            ? "var(--tm-up)"
            : "var(--tm-accent)",
    },
    {
      key: "SỐ PHIÊN NỀN",
      value: candidate?.baseSessions != null ? fmtNum(candidate.baseSessions, 0) : GAP,
      status: candidate?.baseSessions == null ? GAP : candidate.baseSessions >= 8 ? "ĐỦ" : "CHƯA ĐỦ",
      color:
        candidate?.baseSessions == null
          ? "var(--tm-text-faint)"
          : candidate.baseSessions >= 8
            ? "var(--tm-up)"
            : "var(--tm-accent)",
    },
  ];

  // ── Lịch sử bộ quét ──────────────────────────────────────────────────────
  const history: F7HistoryRow[] = input.scanHistory.map((row) => ({
    time: row.sessionDate.toISOString().slice(0, 10),
    message: `Đạt Cổng 2 · Hạng ${row.quality} · điểm ${fmtNum(row.rankScore, 1)}`,
    color: row.quality === "A" ? "var(--tm-up)" : "var(--tm-ref)",
  }));

  return {
    symbol: input.symbol,
    close,
    changePct,
    tier: candidate?.quality ?? null,
    rankScore: candidate ? finite(candidate.rankScore) : null,
    setupId: candidate?.id ?? null,
    zone,
    stop,
    candles: chart?.candles ?? [],
    ma20: chart?.ma20 ?? [],
    zoneBand: band,
    stopY: stop != null && chart != null ? py(stop) : null,
    chartEmptyReason:
      bars.length >= 2
        ? null
        : `Chỉ có ${fmtNum(bars.length, 0)} phiên giá đã lưu cho ${input.symbol} — cần tối thiểu 2 phiên để vẽ nến.`,
    quote,
    tech,
    history,
    historyEmptyReason:
      history.length === 0
        ? `${input.symbol} chưa từng đạt Cổng 2 trong các lần quét đã lưu.`
        : null,
  };
}
