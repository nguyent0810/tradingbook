import type { SurfacedCandidateHealthView } from "@/lib/setup-health/prepare-surfaced-health-view";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import type { Gate2ClosestSymbolRow } from "@/lib/scanner/gate2-scan-diagnostics";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import { computeClosestExecutionStatus } from "@/lib/scanner/closest-execution-metrics";
import { displayNearMissDiagnosticStatus } from "@/lib/trading-display-labels";
import { POSITION_SIZING_DEFAULTS, computePositionSizing } from "@/lib/position-sizing";
import { roundDownToBoardLotShares } from "@/lib/paper-lab/engine/board-lot";
import { applyVerdictToShares, verdictTokens } from "@/lib/terminal/verdict-tokens";
import { semanticTone } from "@/lib/format/vn";
import { healthShortLabel, healthTone, rsTone } from "@/lib/terminal/labels";
import { sessionChangePct } from "@/lib/dashboard/candidate-spark-history";
import type { ScanLogRow } from "./scan-log";

/**
 * View model cho màn F2 Thiết lập & đường ống.
 *
 * Giữ nguyên tầng dữ liệu: mọi con số dẫn xuất từ hàng ứng viên đã lưu, chẩn
 * đoán RS và cấu hình rủi ro của người dùng. Không truy vấn thêm ở đây.
 */

export type F2FunnelCell = {
  key: string;
  value: number | null;
  sub: string;
  color: string;
};

export type F2CandidateRow = {
  symbol: string;
  tier: "A" | "B";
  rankScore: number;
  changePct: number | null;
  hint: string;
};

export type F2NearMissRow = {
  symbol: string;
  status: string;
  statusColor: string;
  rs20: number | null;
  rsColor: string;
};

export type F2Kpi = { key: string; value: string; color: string };

export type F2SizingRow = {
  key: string;
  value: string;
  color: string;
};

export type F2Gate2Row = {
  mark: "✓" | "!" ;
  label: string;
  value: string;
  color: string;
};

export type F2Detail = {
  /** Id ứng viên Cổng 2 — phiếu ghi lệnh cần nó để gọi server action. */
  setupId: string;
  symbol: string;
  tier: "A" | "B";
  rankScore: number;
  close: number | null;
  changePct: number | null;
  /** Giá đóng cửa theo phiên, cũ → mới, cho biểu đồ hồ sơ. */
  closes: number[];
  zoneLow: number;
  zoneHigh: number;
  stop: number;
  kpis: F2Kpi[];
  sizing: F2SizingRow[];
  /** Ghi chú ràng buộc khối lượng theo phán quyết; `null` khi không có phán quyết. */
  sizingNote: string | null;
  /** `true` khi không đủ dữ liệu để tính khối lượng — không được đoán. */
  sizingBlocked: string | null;
  /** Khối lượng hệ thống tính TRƯỚC ràng buộc phán quyết; `null` khi không tính được. */
  systemShares: number | null;
  gate2: F2Gate2Row[];
};

export type F2ViewModel = {
  funnel: F2FunnelCell[];
  scanLabel: string;
  scanId: string | null;
  candidates: F2CandidateRow[];
  candidatesEmptyReason: string | null;
  nearMiss: F2NearMissRow[];
  nearMissEmptyReason: string | null;
  rsWatch: F2NearMissRow[];
  rsWatchEmptyReason: string | null;
  details: Record<string, F2Detail>;
  /** Mã được chọn mặc định — ứng viên điểm cao nhất. */
  defaultSymbol: string | null;
  scanLog: ScanLogRow[];
  verdict: { level: VerdictUxLevel; code: string; color: string; allocation: string } | null;
  verdictBlockedReason: string | null;
};

const NEAR_MISS_COLOR: Record<string, string> = {
  READY: "var(--tm-floor)",
  WAIT: "var(--tm-accent)",
  INVALID: "var(--tm-ceil)",
};

/** Mặc định hệ thống cho định cỡ vị thế, khớp panel định cỡ hiện có. */
/** Mặc định hệ thống — dùng CHUNG với server action ghi lệnh. */
const SIZING_FALLBACK = POSITION_SIZING_DEFAULTS;

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function fmtVndShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const nf = (v: number, d: number) =>
    v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (abs >= 1_000_000_000) return `${sign}${nf(abs / 1_000_000_000, 2)} tỷ ₫`;
  if (abs >= 1_000_000) return `${sign}${nf(abs / 1_000_000, 1)} tr ₫`;
  return `${sign}${nf(abs, 0)} ₫`;
}

function pct(value: number, digits = 1): string {
  return `${value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

function num(value: number, digits = 0): string {
  return value.toLocaleString("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function buildKpis(
  candidate: SurfacedCandidateHealthView,
  rs: RsDiagnosticUi | null,
  advVnd: number | null
): F2Kpi[] {
  const target = candidate.pullbackZoneHigh * 1.12;
  const risk = candidate.pullbackZoneHigh - candidate.stopLevel;
  const reward = target - candidate.pullbackZoneHigh;
  const rr = risk > 0 ? reward / risk : null;
  const rs20 = finite(rs?.rs20SpreadPct);


  const zoneReady =
    Number.isFinite(candidate.pullbackZoneLow) && Number.isFinite(candidate.pullbackZoneHigh);

  return [
    {
      key: "VÙNG MUA",
      value: `${num(candidate.pullbackZoneLow, 2)}–${num(candidate.pullbackZoneHigh, 2)}`,
      color: zoneReady ? "var(--tm-up)" : "var(--tm-text-faint)",
    },
    {
      key: "CẮT LỖ",
      value: num(candidate.stopLevel, 2),
      color: semanticTone(candidate.stopLevel, "var(--tm-down-soft)"),
    },
    { key: "MỤC TIÊU 1", value: num(target, 2), color: semanticTone(target, "var(--tm-up-soft)") },
    {
      key: "R:R",
      value: rr != null ? `1:${num(rr, 1)}` : "—",
      color: rr != null ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
    {
      key: "RS20 vs VNINDEX",
      value: rs20 != null ? `${rs20 >= 0 ? "+" : ""}${num(rs20, 1)}` : "—",
      color: rsTone(rs20),
    },
    {
      key: "SỨC KHOẺ",
      value: `${healthShortLabel(candidate.healthLevel)} ${num(candidate.healthScore, 0)}`,
      color: healthTone(candidate.healthLevel),
    },
    {
      key: "GTGD 20N",
      value: advVnd != null ? fmtVndShort(advVnd) : "—",
      color: advVnd != null ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
    {
      key: "GIÁ ĐÓNG",
      value: num(candidate.close, 2),
      color: semanticTone(candidate.close, "var(--tm-text-value)"),
    },
  ];
}

export type SizingInput = {
  equityVnd: number | null;
  baseRiskPct: number | null;
  maxTradePct: number | null;
  liquidityCapPct: number | null;
  /**
   * Giá trị các vị thế đang mở. Phải truyền vào: server dùng số này khi ghi lệnh,
   * nếu màn hình tính với 0 thì khối lượng đề xuất sẽ cao hơn mức server cho phép
   * và người dùng chỉ biết khi phiếu báo lỗi.
   *
   * `null` = **không đọc được**, KHÔNG phải "không có vị thế nào". Hai trường hợp
   * này cho ra khối lượng khác nhau nên không được gộp: đọc lỗi thì chặn định cỡ.
   */
  currentExposureVnd: number | null;
  advVnd: number | null;
};

function buildSizing(
  candidate: SurfacedCandidateHealthView,
  sizingInput: SizingInput,
  verdictLevel: VerdictUxLevel | null
): Pick<F2Detail, "sizing" | "sizingNote" | "sizingBlocked" | "systemShares"> {
  const equity = finite(sizingInput.equityVnd);
  if (equity == null || equity <= 0) {
    return {
      sizing: [],
      sizingNote: null,
      systemShares: null,
      sizingBlocked:
        "Chưa đặt vốn tài khoản trong Cài đặt (F5) nên không tính được khối lượng. Không suy đoán từ giá trị mặc định.",
    };
  }

  if (sizingInput.currentExposureVnd == null) {
    return {
      sizing: [],
      sizingNote: null,
      systemShares: null,
      sizingBlocked:
        "Không đọc được giá trị các vị thế đang mở nên không tính được khối lượng. " +
        "Coi như 0 sẽ cho ra khối lượng CAO HƠN trần mà server áp khi ghi lệnh.",
    };
  }

  const baseRiskPct = sizingInput.baseRiskPct ?? SIZING_FALLBACK.baseRiskPerTradePct;
  const result = computePositionSizing({
    accountEquityVnd: equity,
    maxPortfolioExposurePct: SIZING_FALLBACK.maxPortfolioExposurePct,
    currentPortfolioExposureVnd: sizingInput.currentExposureVnd,
    maxPerTradeExposurePct: sizingInput.maxTradePct ?? SIZING_FALLBACK.maxPerTradeExposurePct,
    baseRiskPerTradePct: baseRiskPct,
    quality: candidate.quality === "A" ? "A" : "B",
    entryKVnd: candidate.pullbackZoneHigh,
    stopKVnd: candidate.stopLevel,
    liquidityCapPct: sizingInput.liquidityCapPct ?? SIZING_FALLBACK.liquidityCapPct,
    symbolAvgDailyValueVnd: sizingInput.advVnd,
  });

  if (!result.ok) {
    return {
      sizing: [],
      sizingNote: null,
      systemShares: null,
      sizingBlocked: `Không tính được khối lượng (mã lỗi ${result.code}) từ vùng mua ${num(
        candidate.pullbackZoneHigh,
        2
      )} và cắt lỗ ${num(candidate.stopLevel, 2)}.`,
    };
  }

  const value = result.value;
  // Khối lượng chuẩn hiển thị đã làm tròn xuống lô chẵn 100 cp: số lẻ không đặt
  // được lệnh, hiện nó sẽ khiến hàng "khối lượng chuẩn" và hàng theo phán quyết
  // trông như lệch nhau vì lý do khác.
  const standardLot = roundDownToBoardLotShares(value.qFinalShares);
  const standardShares = standardLot.ok ? standardLot.quantity : 0;

  const tokens = verdictLevel ? verdictTokens(verdictLevel) : null;
  const applied = verdictLevel ? applyVerdictToShares(standardShares, verdictLevel) : null;
  const finalShares = applied ? applied.shares : standardShares;
  const finalNotional = finalShares * value.entryVndPerShare;

  const rows: F2SizingRow[] = [
    { key: "Vốn tài khoản", value: fmtVndShort(equity), color: "var(--tm-text-value)" },
    {
      key: "Rủi ro mỗi lệnh",
      value: `${pct(baseRiskPct * 100, 2)} · ${fmtVndShort(value.riskBudgetVnd)}`,
      color: "var(--tm-accent)",
    },
    {
      key: "Rủi ro / cổ phiếu",
      value: fmtVndShort(value.perShareRiskVnd),
      color: "var(--tm-down-soft)",
    },
    {
      key: "Khối lượng chuẩn",
      value: `${num(standardShares, 0)} cp`,
      color: standardShares > 0 ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
  ];

  if (tokens && applied) {
    rows.push({
      key: `Khối lượng ${tokens.sizeLabel}`,
      value: `${num(applied.shares, 0)} cp`,
      color: tokens.color,
    });
  }

  rows.push(
    { key: "Giá trị vị thế", value: fmtVndShort(finalNotional), color: "var(--tm-text-value)" },
    {
      key: "% NAV",
      value: pct((finalNotional / equity) * 100, 1),
      color: "var(--tm-floor)",
    }
  );

  if (value.liquidityCapBinding) {
    rows.push({
      key: "Ràng buộc",
      value: "Trần thanh khoản",
      color: "var(--tm-ref)",
    });
  }

  const sizingNote = tokens
    ? applied && applied.removedShares > 0
      ? `Phán quyết ${tokens.code} — khối lượng đề xuất còn ${tokens.sizeLabel} khối lượng chuẩn (giảm ${num(
          applied.removedShares,
          0
        )} cp). ${tokens.sizeReason}.`
      : `Phán quyết ${tokens.code} — cho phép khối lượng chuẩn.`
    : null;

  return { sizing: rows, sizingNote, sizingBlocked: null, systemShares: standardShares };
}

/**
 * Tiêu chí Cổng 2 của ứng viên.
 *
 * Bộ quét lưu lý do dưới dạng dòng chữ, không phải danh sách pass/fail có cấu
 * trúc — nên dòng lý do (điều kiện ứng viên đã đạt để lộ diện) mang dấu `✓`,
 * còn cờ sức khoẻ (cảnh báo sau khi quét) mang dấu `!`. Không bịa thêm tiêu chí.
 */
function buildGate2Rows(
  candidate: SurfacedCandidateHealthView,
  reasonLines: string[]
): F2Gate2Row[] {
  const rows: F2Gate2Row[] = reasonLines.map((line) => ({
    mark: "✓" as const,
    label: line,
    value: "ĐẠT",
    color: "var(--tm-up)",
  }));

  for (const line of candidate.healthLines) {
    rows.push({
      mark: "!",
      label: line,
      value: "CẢNH BÁO",
      color: "var(--tm-accent)",
    });
  }

  return rows;
}

export type F2ViewModelInput = {
  candidates: SurfacedCandidateHealthView[];
  /** Dòng lý do Cổng 2 đã làm sạch, theo mã. */
  reasonLinesBySymbol: Record<string, string[]>;
  rsBySymbol: Map<string, RsDiagnosticUi | null>;
  advBySymbolId: Map<string, number | null>;
  closesBySymbolId: Map<string, number[]>;
  sizing: Omit<SizingInput, "advVnd">;
  closest: Gate2ClosestSymbolRow[];
  rsWatchRows: { symbol: string; rs20SpreadPct: number; topRejectionReason: string }[];
  rsWatchEmptyReason: string | null;
  funnel: {
    universeScanned: number | null;
    statusFilterPassed: number | null;
    tradabilityPassed: number | null;
    qualifiedTotal: number | null;
  };
  scanLabel: string;
  scanId: string | null;
  scanLog: ScanLogRow[];
  candidatesEmptyReason: string | null;
  verdictLevel: VerdictUxLevel | null;
  verdictAllocation: string | null;
  verdictBlockedReason: string | null;
};

export function buildF2ViewModel(input: F2ViewModelInput): F2ViewModel {
  const nearMissCount = input.closest.length;

  // Màu nhận diện của bậc phễu chỉ áp khi bậc đó CÓ số đo. Bậc chưa đo được hiện
  // "—" mà vạch vẫn mang màu bậc thì trông như một phép đo đã chạy xong — cùng
  // lỗi đã sửa cho phễu của F1.
  const funnelStage = (key: string, value: number | null, sub: string, tone: string) => ({
    key,
    value,
    sub,
    color: value != null ? tone : "var(--tm-text-faint)",
  });

  const funnel: F2FunnelCell[] = [
    funnelStage("VŨ TRỤ ĐÃ QUÉT", input.funnel.universeScanned, "mã / phiên", "var(--tm-floor)"),
    funnelStage("LỌC TRẠNG THÁI", input.funnel.statusFilterPassed, "còn lại", "var(--tm-floor)"),
    funnelStage(
      "KHẢ NĂNG GIAO DỊCH",
      input.funnel.tradabilityPassed,
      "sau thanh khoản",
      "var(--tm-ceil)"
    ),
    funnelStage("SUÝT ĐẠT", nearMissCount, "chờ điều kiện", "var(--tm-accent)"),
    funnelStage("ĐẠT CỔNG 2", input.funnel.qualifiedTotal, "hạng A/B", "var(--tm-up)"),
  ];

  const details: Record<string, F2Detail> = {};
  const candidates: F2CandidateRow[] = [];

  for (const candidate of input.candidates) {
    const closes = input.closesBySymbolId.get(candidate.symbolId) ?? [];
    const changePct = sessionChangePct(closes);
    const rs = input.rsBySymbol.get(candidate.symbolKey) ?? null;
    const advVnd = input.advBySymbolId.get(candidate.symbolId) ?? null;
    const tier = candidate.quality === "A" ? "A" : "B";

    candidates.push({
      symbol: candidate.symbolKey,
      tier,
      rankScore: candidate.rankScore,
      changePct,
      hint: candidate.healthSummary ?? candidate.healthHint ?? "Đã đạt Cổng 2",
    });

    details[candidate.symbolKey] = {
      setupId: candidate.id,
      symbol: candidate.symbolKey,
      tier,
      rankScore: candidate.rankScore,
      close: finite(candidate.close),
      changePct,
      closes,
      zoneLow: candidate.pullbackZoneLow,
      zoneHigh: candidate.pullbackZoneHigh,
      stop: candidate.stopLevel,
      kpis: buildKpis(candidate, rs, advVnd),
      ...buildSizing(candidate, { ...input.sizing, advVnd }, input.verdictLevel),
      gate2: buildGate2Rows(candidate, input.reasonLinesBySymbol[candidate.symbolKey] ?? []),
    };
  }

  const nearMiss: F2NearMissRow[] = input.closest.map((row) => {
    const status = computeClosestExecutionStatus(
      row.terminalCategory,
      row.close,
      row.pullbackZoneLow,
      row.pullbackZoneHigh
    );
    // Chẩn đoán RS lấy từ bản đồ RS, không có trên hàng suýt đạt đã lưu.
    const rs20 = finite(input.rsBySymbol.get(row.symbol)?.rs20SpreadPct);
    return {
      symbol: row.symbol,
      status: displayNearMissDiagnosticStatus(status),
      statusColor: NEAR_MISS_COLOR[status] ?? "var(--tm-accent)",
      rs20,
      rsColor: rsTone(rs20),
    };
  });

  const rsWatch: F2NearMissRow[] = input.rsWatchRows.map((row) => ({
    symbol: row.symbol,
    status: row.topRejectionReason,
    statusColor: "var(--tm-ceil)",
    rs20: finite(row.rs20SpreadPct),
    rsColor: rsTone(row.rs20SpreadPct),
  }));

  const tokens = input.verdictLevel ? verdictTokens(input.verdictLevel) : null;

  return {
    funnel,
    scanLabel: input.scanLabel,
    scanId: input.scanId,
    candidates,
    candidatesEmptyReason: candidates.length === 0 ? input.candidatesEmptyReason : null,
    nearMiss,
    nearMissEmptyReason:
      nearMiss.length === 0
        ? "Lần quét gần nhất không ghi mã nào vào lane chẩn đoán suýt đạt."
        : null,
    rsWatch,
    rsWatchEmptyReason: rsWatch.length === 0 ? input.rsWatchEmptyReason : null,
    details,
    defaultSymbol: candidates[0]?.symbol ?? null,
    scanLog: input.scanLog,
    verdict:
      tokens && input.verdictLevel
        ? {
            level: input.verdictLevel,
            code: tokens.code,
            color: tokens.color,
            allocation: input.verdictAllocation ?? tokens.sizeLabel,
          }
        : null,
    verdictBlockedReason: input.verdictBlockedReason,
  };
}
