import type {
  DataProvenance,
  DecisionCockpitDto,
  VerdictUxLevel,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { LiveGate1Reading } from "@/lib/terminal/gate1-live";
import type { SurfacedCandidateHealthView } from "@/lib/setup-health/prepare-surfaced-health-view";
import type { RsDiagnosticUi } from "@/lib/scanner/gate2/rs-diagnostic-format";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import { sessionChangePct } from "@/lib/dashboard/candidate-spark-history";
import { healthShortLabel, healthTone, lifecycleShortLabel, lifecycleTone, rsTone } from "@/lib/terminal/labels";
import { gate1Color, gate1Label, verdictTokens } from "@/lib/terminal/verdict-tokens";

/**
 * View model cho màn F1 Điều khiển.
 *
 * Tầng dữ liệu giữ nguyên: mọi thứ ở đây dẫn xuất từ `DecisionCockpitDto` cộng
 * vài mảng số thô. Mục đích là để component F1 hoàn toàn "câm" — không tự suy
 * diễn, không tự quyết định màu, nên logic có chỗ để kiểm thử.
 */

export type Tone = string;

export type F1VerdictPanel = {
  level: VerdictUxLevel;
  code: string;
  color: Tone;
  headBg: Tone;
  /** Tiêu đề trader-facing từ DTO. */
  headline: string;
  /** Trạng thái sổ lệnh đã lưu (NO_TRADE · NORMAL …) + ghi chú. */
  bookStance: string;
  explanation: string;
  allocation: string;
  perTrade: string;
  confidenceLabel: string;
  confidenceBars: number;
  provenance: DataProvenance;
  /**
   * Khác `null` khi Cổng 1 trực tiếp chưa đánh giá được. Lúc đó phán quyết
   * trong DTO đang tựa lên một mức WARNING mặc định chứ không phải phép đo, nên
   * F1 không trình bày nó như một phán quyết hợp lệ.
   */
  untrusted: { reason: string } | null;
};

export type F1BlockerRow = {
  tag: string;
  title: string;
  note: string;
  color: Tone;
};

export type F1Gate1Row = {
  key: string;
  value: string;
  color: Tone;
};

export type F1SetupRow = {
  symbol: string;
  tier: "A" | "B";
  rankScore: number;
  close: number | null;
  changePct: number | null;
  zoneLow: number | null;
  zoneHigh: number | null;
  stop: number | null;
  rs20: number | null;
  rsColor: Tone;
  healthLabel: string;
  healthScore: number | null;
  healthColor: Tone;
  actionHint: string;
  spark: number[];
};

export type F1NearMissRow = {
  symbol: string;
  status: string;
  statusColor: Tone;
  reason: string;
  distancePct: number | null;
  rs20: number | null;
  rsColor: Tone;
  waitFor: string;
};

export type F1FunnelRow = {
  key: string;
  value: number | null;
  pctOfUniverse: number | null;
  /** Bề rộng thanh (0–100), đã chuẩn hoá để bước nhỏ vẫn nhìn thấy. */
  barWidth: number;
  color: Tone;
};

export type F1IndexPanel = {
  latestClose: number | null;
  changePct: number | null;
  points: number[];
  /** Nhãn phiên đầu và cuối của chuỗi. */
  firstLabel: string;
  lastLabel: string;
  /** Nguyên văn lỗi truy vấn — `null` khi đọc được. Không phải cờ boolean: panel
   *  phải in được BẰNG CHỨNG thật, không phải một câu viết cứng. */
  error: string | null;
};

export type F1PlanRow = { n: string; title: string; note: string };

export type F1WatchRow = {
  symbol: string;
  state: string;
  stateColor: Tone;
  close: number | null;
  changePct: number | null;
};

export type F1EvidenceRow = {
  id: string;
  label: string;
  display: string;
  hint: string | null;
  provenance: DataProvenance;
};

export type F1ViewModel = {
  verdict: F1VerdictPanel;
  blockers: F1BlockerRow[];
  blockersEmptyReason: string | null;
  gate1Rows: F1Gate1Row[];
  gate1Note: string;
  setups: F1SetupRow[];
  setupsEmptyReason: string | null;
  nearMiss: F1NearMissRow[];
  nearMissEmptyReason: string | null;
  funnel: F1FunnelRow[];
  index: F1IndexPanel;
  plan: F1PlanRow[];
  watch: F1WatchRow[];
  watchTruncated: boolean;
  evidence: F1EvidenceRow[];
  scanRunId: string | null;
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "CAO",
  medium: "TRUNG BÌNH",
  low: "THẤP",
};

const CONFIDENCE_BARS: Record<string, number> = { high: 5, medium: 3, low: 2 };

const BLOCKER_TAG: Record<string, string> = {
  market_off: "THỊ TRƯỜNG",
  structure_broken: "CẤU TRÚC",
  extension: "MỞ RỘNG",
  timing: "THỜI ĐIỂM",
  info: "DỮ LIỆU",
};

const BLOCKER_COLOR: Record<string, string> = {
  market_off: "var(--tm-down)",
  structure_broken: "var(--tm-down)",
  extension: "var(--tm-accent)",
  timing: "var(--tm-floor)",
  info: "var(--tm-ceil)",
};

/**
 * Màu theo trạng thái chẩn đoán (`ClosestExecutionStatus`).
 * READY ở đây **không phải** tín hiệu vào lệnh — chỉ là "giá đang trong vùng
 * nhưng Cổng 2 chưa xác thực" — nên dùng lơ (thông tin), không dùng xanh (ĐẠT).
 */
const NEAR_MISS_COLOR: Record<string, string> = {
  READY: "var(--tm-floor)",
  WAIT: "var(--tm-accent)",
  INVALID: "var(--tm-ceil)",
};

function tierOf(quality: string): "A" | "B" {
  return quality === "A" ? "A" : "B";
}

function finite(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/**
 * Bề rộng thanh phễu. Dùng căn bậc hai của tỉ lệ để bước cuối (5/1.605 ≈ 0,3%)
 * vẫn còn thấy được — thanh đúng tỉ lệ tuyến tính sẽ mảnh tới mức vô hình.
 * Con số thật vẫn hiện nguyên bên cạnh, thanh chỉ để so sánh nhanh.
 */
function funnelBarWidth(value: number | null, universe: number | null): number {
  if (value == null || universe == null || universe <= 0) return 0;
  const frac = Math.max(0, Math.min(1, value / universe));
  return Math.round(Math.sqrt(frac) * 100);
}

export type F1ViewModelInput = {
  cockpit: DecisionCockpitDto;
  /** Ứng viên đã kèm sức khoẻ — nguồn giá / vùng mua / cắt lỗ cho bảng A/B. */
  candidates: SurfacedCandidateHealthView[];
  rsDiagnosticsBySymbol: Record<string, RsDiagnosticUi> | undefined;
  /** Giá đóng 20 phiên theo symbolId, cho sparkline và cột +/-. */
  sparkBySymbolId: Map<string, number[]>;
  /**
   * Kết quả đọc Cổng 1 **trực tiếp**. Chỉ dùng để biết chế độ live có thật sự
   * được đánh giá hay không — mức chuẩn luôn lấy từ `gate1Resolution.canonical`
   * của DTO, thứ mà phán quyết đang dựa vào.
   */
  liveGate1: LiveGate1Reading;
  vnindexHistory: VnindexHistoryPoint[];
  vnindexHistoryError: string | null;
  /** Số mã trong danh mục theo dõi và giá đóng gần nhất. */
  watchItems: { symbol: string; lifecycleStatus: string; symbolId: string }[];
  /**
   * Khoá là **`symbolId`**, KHÔNG phải mã cổ phiếu — `buildLatestCloseBySymbol()`
   * dựng map theo id. Tên biến ghi rõ khoá để không tra nhầm bằng `item.symbol`
   * rồi lặng lẽ ra `—` cho mọi hàng dù truy vấn có dữ liệu thật.
   */
  latestCloseBySymbolId: Map<string, number>;
  watchTruncated: boolean;
  /** Tổng vũ trụ đã quét — mẫu số của phễu. */
  universeScanned: number | null;
  tradabilityPassed: number | null;
  statusFilterPassed: number | null;
};

function buildVerdict(
  cockpit: DecisionCockpitDto,
  liveGate1: LiveGate1Reading
): F1VerdictPanel {
  const v = cockpit.verdict;
  const level = v.uxLevel.value;
  const band = v.confidenceBand.value;

  // Màu, nền và mã hiển thị lấy từ token phán quyết dùng chung — cùng nguồn với
  // ô PHÁN QUYẾT ở thanh trạng thái, nên hai chỗ không thể lệch nhau (QA §4).
  const tokens = verdictTokens(level);

  const base: F1VerdictPanel = {
    level,
    code: tokens.code,
    color: tokens.color,
    headBg: tokens.headBg,
    headline: v.headline.value,
    bookStance: `${v.persistedLevel.value} · ${v.persistedLevelNote.value}`,
    explanation: v.explanation.value,
    allocation: v.allocation.value,
    perTrade: v.perTradeGuidance.value,
    confidenceLabel: CONFIDENCE_LABEL[band] ?? band.toUpperCase(),
    confidenceBars: CONFIDENCE_BARS[band] ?? 3,
    provenance: v.uxLevel.provenance,
    untrusted: null,
  };

  if (liveGate1.level !== null) return base;

  // Không đo được chế độ thị trường thì không có phán quyết. `regime.level` lúc
  // này là WARNING mặc định của hàm nạp, và DTO đã dùng nó để chốt Cổng 1 chuẩn
  // — nghĩa là con số phía sau phán quyết không có phép đo nào chống lưng.
  // Bàn giao §6: ô mang nhãn gap không được dùng để tính phán quyết.
  return {
    ...base,
    code: "—",
    // Trung tính, KHÔNG mượn màu NO_TRADE: mã đã là "—" mà panel vẫn đỏ thì màu
    // đang khẳng định một kết luận rủi ro cụ thể ở nơi chưa đo được gì. Hai
    // trạng thái này dẫn tới hai hành động khác nhau — NO_TRADE thì chờ điều
    // kiện, chưa đo được thì đi nạp dữ liệu.
    color: "var(--tm-text-faint)",
    headBg: "var(--tm-head-unknown)",
    headline: "Chưa đánh giá được phán quyết",
    explanation:
      `Chế độ thị trường (Cổng 1) chưa đo được nên phán quyết phiên không có cơ sở. ` +
      `${liveGate1.error ?? ""} Nạp đủ dữ liệu VNINDEX rồi tải lại trước khi vào lệnh.`.trim(),
    allocation: "—",
    perTrade: "—",
    confidenceLabel: "—",
    confidenceBars: 0,
    provenance: "gap",
    untrusted: { reason: liveGate1.error ?? "Cổng 1 trực tiếp chưa đánh giá được." },
  };
}

function buildGate1Rows(
  cockpit: DecisionCockpitDto,
  liveGate1: LiveGate1Reading
): F1Gate1Row[] {
  const res = cockpit.verdict.gate1Resolution;
  // Mức chuẩn LUÔN là thứ DTO đã chốt — chính nó sinh ra phán quyết. Không được
  // ghi đè bằng mức live: nếu bản đã lưu xấu hơn, ghi đè sẽ khiến panel Cổng 1
  // khoe mức tốt hơn trong khi phán quyết vẫn tính trên mức xấu hơn.
  const canonical = res.canonical;
  const liveEvaluated = liveGate1.level !== null;

  const rows: F1Gate1Row[] = [
    {
      key: "CỔNG 1 · TRỰC TIẾP",
      // Chưa đánh giá được thì để gap — `regime.level` lúc đó là WARNING mặc
      // định của hàm nạp, không phải một phép đo thật.
      value: liveEvaluated ? gate1Label(res.liveRegimeGate1) : "—",
      color: liveEvaluated ? gate1Color(res.liveRegimeGate1) : "var(--tm-text-faint)",
    },
    {
      key: "CỔNG 1 · LẦN QUÉT",
      value: res.scanGate1 ? gate1Label(res.scanGate1) : "—",
      color: res.scanGate1 ? gate1Color(res.scanGate1) : "var(--tm-text-faint)",
    },
    {
      key: "NGUỒN CHUẨN",
      // Khi live xấu hơn bản đã lưu, UI phải nói rõ nguồn chuẩn là live (QA §5).
      value: res.liveOverrideApplied
        ? "TRỰC TIẾP (XẤU HƠN)"
        : res.source === "scan_run"
          ? "LẦN QUÉT"
          : "TRỰC TIẾP",
      color: res.liveOverrideApplied ? "var(--tm-down)" : "var(--tm-text-mute)",
    },
    {
      key: "PHÁN QUYẾT DÙNG",
      value: gate1Label(canonical),
      color: gate1Color(canonical),
    },
  ];

  return rows;
}

/**
 * Ghi chú Cổng 1. Khi chế độ trực tiếp chưa đánh giá được, nối thêm bằng chứng
 * thật — người đọc phải biết mức chuẩn đang tựa lên một phép đo không có.
 */
function buildGate1Note(cockpit: DecisionCockpitDto, liveGate1: LiveGate1Reading): string {
  const note = cockpit.verdict.gate1Resolution.note;
  if (liveGate1.error == null) return note;
  return `${note} Cảnh báo: ${liveGate1.error}`;
}

function buildSetups(input: F1ViewModelInput): F1SetupRow[] {
  const { cockpit, candidates, rsDiagnosticsBySymbol, sparkBySymbolId } = input;
  const bySymbol = new Map(candidates.map((c) => [c.symbolKey, c]));

  return cockpit.opportunity.candidates.map((candidate) => {
    const row = bySymbol.get(candidate.symbol);
    const spark = row ? (sparkBySymbolId.get(row.symbolId) ?? []) : [];
    const rs20 = finite(rsDiagnosticsBySymbol?.[candidate.symbol]?.rs20SpreadPct);

    return {
      symbol: candidate.symbol,
      tier: tierOf(candidate.quality),
      rankScore: candidate.rankScore,
      close: finite(row?.close),
      changePct: sessionChangePct(spark),
      zoneLow: finite(row?.pullbackZoneLow),
      zoneHigh: finite(row?.pullbackZoneHigh),
      stop: finite(row?.stopLevel),
      rs20,
      rsColor: rsTone(rs20),
      healthLabel: healthShortLabel(candidate.healthLevel),
      healthScore: finite(row?.healthScore),
      healthColor: healthTone(candidate.healthLevel),
      actionHint: candidate.actionHint,
      spark,
    };
  });
}

function buildNearMiss(cockpit: DecisionCockpitDto): F1NearMissRow[] {
  return cockpit.opportunity.nearMiss.map((row) => {
    const rs20 = finite(row.rsDiagnostic?.rs20SpreadPct);
    return {
      symbol: row.symbol,
      status: row.executionStatusLabel,
      statusColor: NEAR_MISS_COLOR[row.executionStatus] ?? "var(--tm-accent)",
      reason: row.terminalCategory,
      distancePct: finite(row.distanceToZonePct),
      rs20,
      rsColor: rsTone(rs20),
      waitFor: row.waitFor,
    };
  });
}

function buildFunnel(input: F1ViewModelInput): F1FunnelRow[] {
  const { cockpit, universeScanned, statusFilterPassed, tradabilityPassed } = input;
  const funnel = cockpit.gateFunnel;
  const nearMissCount = cockpit.opportunity.nearMiss.length;
  const universe = finite(universeScanned);

  const stages: { key: string; value: number | null; color: string }[] = [
    { key: "VŨ TRỤ ĐÃ QUÉT", value: universe, color: "var(--tm-floor)" },
    { key: "LỌC TRẠNG THÁI", value: finite(statusFilterPassed), color: "var(--tm-floor)" },
    { key: "KHẢ NĂNG GIAO DỊCH", value: finite(tradabilityPassed), color: "var(--tm-ceil)" },
    { key: "SUÝT ĐẠT", value: nearMissCount, color: "var(--tm-accent)" },
    { key: "ĐẠT CỔNG 2 · A/B", value: funnel ? funnel.qualifiedTotal : null, color: "var(--tm-up)" },
  ];

  return stages.map((stage) => ({
    key: stage.key,
    value: stage.value,
    pctOfUniverse:
      stage.value != null && universe != null && universe > 0
        ? (stage.value / universe) * 100
        : null,
    barWidth: funnelBarWidth(stage.value, universe),
    // Màu nhận diện của bậc phễu chỉ áp khi bậc đó CÓ số. Ô "—" mang màu bậc
    // trông như một phép đo đã chạy xong; gap thì phải trung tính.
    color: stage.value != null ? stage.color : "var(--tm-text-faint)",
  }));
}

function buildIndex(input: F1ViewModelInput): F1IndexPanel {
  const points = input.vnindexHistory.map((p) => p.close).filter((c) => Number.isFinite(c));
  const latestClose = points.length > 0 ? points[points.length - 1] : null;

  return {
    latestClose,
    changePct: sessionChangePct(points),
    points,
    firstLabel: input.vnindexHistory[0]?.date ?? "—",
    lastLabel: input.vnindexHistory[input.vnindexHistory.length - 1]?.date ?? "—",
    error: input.vnindexHistoryError,
  };
}

function buildPlan(cockpit: DecisionCockpitDto): F1PlanRow[] {
  const t = cockpit.tomorrow;
  const rows: F1PlanRow[] = [];

  const symbols = t.watchSymbols.value;
  symbols.forEach((symbol, i) => {
    rows.push({
      n: String(i + 1),
      title: `Theo dõi ${symbol}`,
      note: t.watchReasons[symbol] ?? "Chờ điều kiện vào lệnh.",
    });
  });

  if (symbols.length === 0 && t.watchNote.value) {
    rows.push({ n: "1", title: "Không có mã nào để theo dõi", note: t.watchNote.value });
  }

  rows.push({
    n: String(rows.length + 1),
    title: "Điều kiện kích hoạt",
    note: t.triggerLine.value,
  });
  rows.push({
    n: String(rows.length + 1),
    title: "Cần tránh",
    note: t.avoidLine.value,
  });

  return rows;
}

function buildWatch(input: F1ViewModelInput): F1WatchRow[] {
  return input.watchItems.map((item) => ({
    symbol: item.symbol,
    state: lifecycleShortLabel(item.lifecycleStatus),
    stateColor: lifecycleTone(item.lifecycleStatus),
    close: finite(input.latestCloseBySymbolId.get(item.symbolId)),
    // Danh mục theo dõi chỉ có giá đóng gần nhất, không có phiên liền trước —
    // để gap thay vì tính biến động từ dữ liệu không có.
    changePct: null,
  }));
}

export function buildF1ViewModel(input: F1ViewModelInput): F1ViewModel {
  const { cockpit } = input;

  return {
    verdict: buildVerdict(cockpit, input.liveGate1),
    blockers: cockpit.blockers.map((b) => ({
      tag: BLOCKER_TAG[b.severity] ?? b.severity.toUpperCase(),
      title: b.title,
      note:
        b.sampleSymbols.length > 0
          ? `${b.meaning} · ${b.sampleSymbols.slice(0, 4).join(" ")}`
          : b.meaning,
      color: BLOCKER_COLOR[b.severity] ?? "var(--tm-accent)",
    })),
    blockersEmptyReason: cockpit.actionableDiagnostics.emptyReason,
    gate1Rows: buildGate1Rows(cockpit, input.liveGate1),
    gate1Note: buildGate1Note(cockpit, input.liveGate1),
    setups: buildSetups(input),
    setupsEmptyReason:
      cockpit.opportunity.candidates.length === 0 ? cockpit.opportunity.emptyReason : null,
    nearMiss: buildNearMiss(cockpit),
    nearMissEmptyReason:
      cockpit.opportunity.nearMiss.length === 0
        ? "Không có mã nào dừng sát ngưỡng Cổng 2 trong lần quét gần nhất."
        : null,
    funnel: buildFunnel(input),
    index: buildIndex(input),
    plan: buildPlan(cockpit),
    watch: buildWatch(input),
    watchTruncated: input.watchTruncated,
    evidence: cockpit.evidence.map((chip) => ({
      id: chip.id,
      label: chip.label,
      display: chip.display,
      hint: chip.hint ?? null,
      provenance: chip.provenance,
    })),
    scanRunId: cockpit.scanRunId,
  };
}
