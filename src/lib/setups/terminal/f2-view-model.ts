import type { SurfacedCandidateHealthView } from "@/lib/setup-health/prepare-surfaced-health-view";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import type { Gate2ClosestSymbolRow } from "@/lib/scanner/gate2-scan-diagnostics";
import type { VerdictUxLevel } from "@/lib/dashboard/decision-cockpit-dto";
import { computeClosestExecutionStatus } from "@/lib/scanner/closest-execution-metrics";
import { displayNearMissDiagnosticStatus } from "@/lib/trading-display-labels";
import { verdictTokens } from "@/lib/terminal/verdict-tokens";
import { fmtSessionDate, semanticTone } from "@/lib/format/vn";
import { healthShortLabel, healthTone, rsTone } from "@/lib/terminal/labels";
import { sessionChangePct } from "@/lib/dashboard/candidate-spark-history";
import {
  CHECKPOINT_N,
  describeSetupReasons,
  type TradeSuggestionResult,
} from "@/lib/trades/trade-suggestion";
import {
  SIZE_BINDING_CAP_COPY,
  type RiskCode,
  type RiskSeverity,
} from "@/lib/trades/trade-suggestion-copy";
import {
  RISK_SEVERITY_TOKENS,
  SUGGESTION_NOT_LOADED_REASON,
  evidenceStatus,
  suggestionUnavailableText,
  type EvidenceStatus,
} from "@/lib/terminal/trade-suggestion-display";
import { SIZING_UNAVAILABLE_COPY, type SizingUnavailable } from "@/lib/trades/screen-trade-suggestions";
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

export type F2SuggestionRow = {
  key: string;
  value: string;
  note: string | null;
  color: string;
};

export type F2SuggestionRisk = {
  code: RiskCode;
  severity: RiskSeverity;
  /** "CAO" / "CHÚ Ý" / "THÔNG TIN". */
  label: string;
  text: string;
  color: string;
};

/**
 * Gợi ý lệnh của ứng viên, dựng sẵn thành chữ. Chỉ để tham khảo (ADR 0003):
 * lời văn mô tả, không thúc giục.
 */
export type F2Suggestion = {
  /** `null` khi tính được; ngược lại "Không đủ dữ liệu — <lý do>". */
  unavailable: string | null;
  /**
   * "Theo phiên dd/mm/yyyy · <sàn>", thêm phiên của thiết lập khi nó cũ hơn;
   * `null` khi không tính được.
   */
  asOf: string | null;
  rows: F2SuggestionRow[];
  targets: F2SuggestionRow[];
  /** Rủi ro, mức cao trước, rồi chú ý, rồi thông tin. */
  risks: F2SuggestionRisk[];
  evidence: EvidenceStatus;
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
  /** Vùng vào và đáy vùng SL của gợi ý lệnh; vùng pullback thô khi không tính được. */
  zoneLow: number;
  zoneHigh: number;
  stop: number;
  kpis: F2Kpi[];
  suggestion: F2Suggestion;
  sizing: F2SizingRow[];
  /** Ghi chú ràng buộc khối lượng theo phán quyết; `null` khi không có phán quyết. */
  sizingNote: string | null;
  /** `true` khi không đủ dữ liệu để tính khối lượng — không được đoán. */
  sizingBlocked: string | null;
  /**
   * Cảnh báo của khối size (#15): lý do size 0 cp, tổng rủi ro mở vượt mốc,
   * lệnh mở chưa có stop, hoặc gợi ý không tính được. Chỉ cảnh báo, không chặn.
   */
  sizingWarnings: string[];
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

const FAINT = "var(--tm-text-faint)";

function buildSuggestion(
  result: TradeSuggestionResult | undefined,
  prospectiveN: number | null
): F2Suggestion {
  if (!result || !result.ok) {
    return {
      unavailable: suggestionUnavailableText(result ? result.detail : SUGGESTION_NOT_LOADED_REASON),
      asOf: null,
      rows: [],
      targets: [],
      risks: [],
      evidence: evidenceStatus(prospectiveN, CHECKPOINT_N),
    };
  }
  const s = result.suggestion;
  return {
    unavailable: null,
    asOf: `Theo phiên ${fmtSessionDate(s.asOfSession)} · ${
      s.exchangeAssumed ? `giả định ${s.exchange}` : s.exchange
    }${s.sessionsSinceSetup > 0 ? ` · thiết lập từ phiên ${fmtSessionDate(s.setupSession)}` : ""}`,
    rows: [
      {
        key: "Vùng vào tham khảo",
        value: `${num(s.entryZone.low, 2)}–${num(s.entryZone.high, 2)}`,
        note: "đã làm tròn bước giá, trong biên độ phiên kế tiếp",
        color: "var(--tm-text-value)",
      },
      {
        key: "Vùng SL",
        value: `${num(s.stopZone.low, 2)}–${num(s.stopZone.high, 2)}`,
        note: `cấu trúc ${num(s.stopZone.structural, 2)} · tối thiểu ${num(s.stopZone.minFeasible, 2)}`,
        color: "var(--tm-down-soft)",
      },
      {
        key: "R / cổ phiếu",
        value: `${num(s.r.perShareGross, 2)} · sau phí ${num(s.r.perShareNet, 2)}`,
        note: "từ đầu trên vùng vào tới đáy vùng SL",
        color: "var(--tm-text-value)",
      },
    ],
    targets: s.targets.map((t) => ({
      key: `Mốc ${t.r}R`,
      value: num(t.price, 2),
      note:
        t.nearestResistance == null
          ? "chưa thấy kháng cự phía trên vùng vào"
          : `kháng cự gần nhất ${num(t.nearestResistance, 2)}${
              t.resistanceBelow ? " · có kháng cự nằm dưới mốc" : ""
            }`,
      color: t.resistanceBelow ? "var(--tm-accent)" : "var(--tm-up-soft)",
    })),
    // Sorted here as well as in the builder: the panel's order is F2's promise.
    // `sort` is stable, so equal severities keep the builder's order.
    risks: [...s.risks]
      .sort((a, b) => RISK_SEVERITY_TOKENS[a.severity].rank - RISK_SEVERITY_TOKENS[b.severity].rank)
      .map((r) => ({
        code: r.code,
        severity: r.severity,
        label: RISK_SEVERITY_TOKENS[r.severity].label,
        text: r.text,
        color: RISK_SEVERITY_TOKENS[r.severity].color,
      })),
    evidence: evidenceStatus(s.evidence.prospectiveN, s.evidence.checkpointN),
  };
}

function buildKpis(
  candidate: SurfacedCandidateHealthView,
  suggestion: TradeSuggestionResult | undefined,
  rs: RsDiagnosticUi | null,
  advVnd: number | null
): F2Kpi[] {
  const rs20 = finite(rs?.rs20SpreadPct);
  const s = suggestion?.ok ? suggestion.suggestion : null;
  const twoR = s?.targets.find((t) => t.r === 2) ?? null;

  return [
    {
      key: "VÙNG VÀO",
      value: s ? `${num(s.entryZone.low, 2)}–${num(s.entryZone.high, 2)}` : "—",
      color: s ? "var(--tm-up)" : FAINT,
    },
    {
      key: "VÙNG SL",
      value: s ? `${num(s.stopZone.low, 2)}–${num(s.stopZone.high, 2)}` : "—",
      color: s ? "var(--tm-down-soft)" : FAINT,
    },
    {
      key: "MỐC 2R",
      value: twoR ? num(twoR.price, 2) : "—",
      color: twoR ? (twoR.resistanceBelow ? "var(--tm-accent)" : "var(--tm-up-soft)") : FAINT,
    },
    {
      key: "R / CP",
      value: s ? num(s.r.perShareGross, 2) : "—",
      color: s ? "var(--tm-text-value)" : FAINT,
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
      color: advVnd != null ? "var(--tm-text-value)" : FAINT,
    },
    {
      key: "GIÁ ĐÓNG",
      value: num(candidate.close, 2),
      color: semanticTone(candidate.close, "var(--tm-text-value)"),
    },
  ];
}

/** Vì sao trang không có đầu vào định cỡ cho gợi ý lệnh — định nghĩa cạnh bộ nạp dùng chung. */
export type { SizingUnavailable };

export type SizingInput = {
  equityVnd: number | null;
  /** `null` khi trang đã giao đủ đầu vào định cỡ cho gợi ý lệnh. */
  unavailable: SizingUnavailable | null;
};


/** Rủi ro của gợi ý lệnh cũng thuộc về khối size: F2 nhắc lại chúng ở đó. */
const SIZING_RISK_CODES: readonly RiskCode[] = ["open_risk_high", "open_risk_unknown"];

/**
 * Khối size của F2: hiện size tham khảo của gợi ý lệnh (#15), cùng một cơ sở
 * rủi ro với vùng vào và vùng SL phía trên (R xấu nhất sau phí cộng đệm gap).
 * Không tự tính lại từ giá thô của ứng viên.
 */
function buildSizing(
  suggestion: TradeSuggestionResult | undefined,
  sizingInput: SizingInput,
  verdictLevel: VerdictUxLevel | null
): Pick<F2Detail, "sizing" | "sizingNote" | "sizingBlocked" | "sizingWarnings" | "systemShares"> {
  const none = { sizing: [], sizingNote: null, systemShares: null };
  const equity = finite(sizingInput.equityVnd);
  const unavailable = sizingInput.unavailable ?? (equity == null || equity <= 0 ? "NO_EQUITY" : null);
  if (unavailable || equity == null) {
    return {
      ...none,
      sizingWarnings: [],
      sizingBlocked: SIZING_UNAVAILABLE_COPY[unavailable ?? "NO_EQUITY"],
    };
  }

  if (!suggestion || !suggestion.ok) {
    return {
      ...none,
      sizingBlocked: null,
      sizingWarnings: [
        `Không đủ dữ liệu để tính size tham khảo — ${
          suggestion ? suggestion.detail : SUGGESTION_NOT_LOADED_REASON
        }`,
      ],
    };
  }
  const s = suggestion.suggestion;
  const size = s.size;
  if (!size) {
    return {
      ...none,
      sizingBlocked: null,
      sizingWarnings: ["Chưa tính được size tham khảo cho gợi ý này."],
    };
  }

  // The size already carries the session verdict (builder): every row below is
  // on `size.shares`, the count shown as the suggestion.
  const tokens = verdictLevel ? verdictTokens(verdictLevel) : null;
  const removedShares = size.sharesBeforeVerdict - size.shares;
  const openRisk = size.openRisk;

  const rows: F2SizingRow[] = [
    { key: "Vốn tài khoản", value: fmtVndShort(equity), color: "var(--tm-text-value)" },
    {
      // Sau hệ số hạng (B = một nửa): đúng mức rủi ro mà size được tính trên đó.
      key: "Rủi ro mỗi lệnh",
      value: `${pct(size.riskPerTradePct * 100, 2)} · ${fmtVndShort(size.riskBudgetVnd)}`,
      color: "var(--tm-accent)",
    },
    {
      key: "Rủi ro / cp",
      value: `${fmtVndShort(size.worstCasePerShareKvnd * 1000)} · R sau phí ${num(
        s.r.perShareNet,
        2
      )} + đệm gap ${num(size.gapBufferKvnd, 2)}`,
      color: "var(--tm-down-soft)",
    },
    {
      key: "Size tham khảo",
      value: `${num(size.shares, 0)} cp`,
      color: size.shares > 0 ? "var(--tm-text-value)" : "var(--tm-text-faint)",
    },
  ];

  if (tokens) {
    rows.push({
      key: `Trước phán quyết ${tokens.code}`,
      value: `${num(size.sharesBeforeVerdict, 0)} cp`,
      color: "var(--tm-text-faint)",
    });
  }

  rows.push(
    {
      key: "Ràng buộc",
      value: size.bindingCap ? SIZE_BINDING_CAP_COPY[size.bindingCap] : "Ngân sách rủi ro",
      color: size.bindingCap ? "var(--tm-ref)" : "var(--tm-text-value)",
    },
    { key: "Lỗ xấu nhất", value: fmtVndShort(size.worstCaseLossVnd), color: "var(--tm-down-soft)" },
    { key: "Rủi ro lệnh", value: `${pct(size.tradeRiskPct, 2)} vốn`, color: "var(--tm-accent)" },
    {
      key: "Tổng rủi ro mở",
      // Một lệnh mở chưa có stop: tổng chỉ là phần đã biết, con số thật từ đó trở lên.
      value: `${openRisk.tradesWithoutStop > 0 ? "≥ " : ""}${fmtVndShort(openRisk.totalVnd)} · ${pct(
        openRisk.totalPct,
        2
      )} vốn`,
      color: openRisk.aboveLimit ? "var(--tm-accent)" : "var(--tm-text-value)",
    },
    { key: "Giá trị vị thế", value: fmtVndShort(size.positionValueVnd), color: "var(--tm-text-value)" },
    {
      key: "% NAV",
      value: pct((size.positionValueVnd / equity) * 100, 1),
      color: "var(--tm-floor)",
    }
  );

  const sizingWarnings = [
    ...(size.zeroShareReason ? [size.zeroShareReason] : []),
    ...s.risks.filter((r) => SIZING_RISK_CODES.includes(r.code)).map((r) => r.text),
  ];

  const sizingNote = tokens
    ? removedShares > 0
      ? `Phán quyết ${tokens.code} — size tham khảo còn ${tokens.sizeLabel} (giảm ${num(
          removedShares,
          0
        )} cp). ${tokens.sizeReason}.`
      : `Phán quyết ${tokens.code} — giữ nguyên size tham khảo.`
    : null;

  return {
    sizing: rows,
    sizingNote,
    sizingBlocked: null,
    sizingWarnings,
    systemShares: size.sharesBeforeVerdict,
  };
}

/**
 * Tiêu chí Cổng 2 của ứng viên.
 *
 * Bộ quét lưu lý do dưới dạng dòng chữ tiếng Anh; mỗi dòng được dịch sang tiếng
 * Việt bằng cùng bảng copy của gợi ý lệnh (`describeSetupReasons`), nên màn này
 * không bao giờ hiện câu tiếng Anh của bộ quét cho một lý do đã có mã. Dòng lý
 * do (điều kiện ứng viên đã đạt để lộ diện) mang dấu `✓`,
 * còn cờ sức khoẻ (cảnh báo sau khi quét) mang dấu `!`. Không bịa thêm tiêu chí.
 */
function buildGate2Rows(
  candidate: SurfacedCandidateHealthView,
  reasonLines: string[]
): F2Gate2Row[] {
  const rows: F2Gate2Row[] = describeSetupReasons(reasonLines).map((reason) => ({
    mark: "✓" as const,
    label: reason.text,
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
  /** Dòng lý do Cổng 2 NGUYÊN VĂN như bộ quét lưu, theo mã; view model dịch sang tiếng Việt. */
  reasonLinesBySymbol: Record<string, string[]>;
  rsBySymbol: Map<string, RsDiagnosticUi | null>;
  advBySymbolId: Map<string, number | null>;
  closesBySymbolId: Map<string, number[]>;
  /** Gợi ý lệnh theo id ứng viên; thiếu = không nạp được dữ liệu để tính. */
  suggestionBySetupId: Map<string, TradeSuggestionResult>;
  /** Số quan sát prospective hợp lệ; `null` = không đọc được registry. */
  prospectiveN: number | null;
  sizing: SizingInput;
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

    const suggestion = input.suggestionBySetupId.get(candidate.id);
    const suggested = suggestion?.ok ? suggestion.suggestion : null;

    details[candidate.symbolKey] = {
      setupId: candidate.id,
      symbol: candidate.symbolKey,
      tier,
      rankScore: candidate.rankScore,
      close: finite(candidate.close),
      changePct,
      closes,
      zoneLow: suggested?.entryZone.low ?? candidate.pullbackZoneLow,
      zoneHigh: suggested?.entryZone.high ?? candidate.pullbackZoneHigh,
      stop: suggested?.stopZone.low ?? candidate.stopLevel,
      kpis: buildKpis(candidate, suggestion, rs, advVnd),
      suggestion: buildSuggestion(suggestion, input.prospectiveN),
      ...buildSizing(suggestion, input.sizing, input.verdictLevel),
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
