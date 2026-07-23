import type { GateFunnelSnapshot } from "@/lib/dashboard/gate-funnel-copy";
import type { LatestScanWithCandidates } from "@/lib/scanner/setups-queries";
import type {
  RsNearMissWatchlistEntryDto,
  RsNearMissWatchlistPanelDto,
} from "@/lib/scanner/gate2/rs-near-miss-watchlist";
import { rejectionBucketTraderGuide } from "@/lib/scanner/setups-trader-copy";
import type {
  V3EarlyEntryDisplay,
  V3RsStateTone,
  V3RsWatchlistCard,
  V3RsWatchlistMetric,
  V3RsWatchlistPanel,
} from "./dashboard-v3-view-model";
import type { EarlyEntryDisplayMetadata } from "@/lib/scanner/early-entry";
import { tradeStateDisplayLabel } from "@/lib/scanner/early-entry";
import {
  buildSetupReason,
  buildSetupStateLabel,
  rsStrengthLabelFromRs20,
} from "./rs-setup-labels";

const INTERNAL_PHRASE_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/Relative strength diagnostic only[^.]*\.?/gi, "Sức mạnh tương đối chỉ là bối cảnh — không thay đổi điểm số thiết lập."],
  [/not used in current Gate 2 pass\/fail[^.]*\.?/gi, ""],
  [/not part of rankScore yet\.?/gi, ""],
  [/Not a Gate 2 SetupCandidate\.?/gi, "Chỉ để theo dõi — không phải thiết lập đạt chuẩn."],
  [/Not used in current trading decision\.?/gi, ""],
  [/Diagnostic only\.?/gi, "Chỉ để tham khảo — không phải tín hiệu giao dịch."],
  [/Gate 2 SetupCandidate/gi, "thiết lập đạt chuẩn"],
  [/rankScore/gi, "điểm số thiết lập"],
  [/extension_cap/gi, "đã mở rộng khỏi breakout"],
  [/Gate 2/gi, "bộ lọc thiết lập"],
  [/Gate 1/gi, "bộ lọc chế độ thị trường"],
];

const FAILED_GATE2_RE = /^Trượt Gate 2 vì:\s*(.+?)(?:\s*\(([a-z0-9_]+)\))?\.?$/i;
const RS_SUMMARY_RE = /RS20\s*([+-]?\d+(?:\.\d+)?)\s*pp(?:\s*·\s*RS50\s*([+-]?\d+(?:\.\d+)?)\s*pp)?/i;
const TREND_OK_RE = /^Trend OK for long-bias pullback:\s*(.+)$/i;

function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+·\s+/g, " · ").trim();
}

function extractCategoryKey(text: string): string | null {
  const paren = text.match(/\(([a-z0-9_]+)\)\s*$/);
  if (paren) return paren[1]!;
  if (/^[a-z0-9_]+$/.test(text.trim())) return text.trim();
  return null;
}

export function formatGateFailureForUser(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(FAILED_GATE2_RE);
  if (match) {
    const body = match[1]!.trim();
    const code = match[2] ?? extractCategoryKey(body);
    if (code === "breakout_recency") {
      return "Chưa sẵn sàng — chưa có breakout mới được xác nhận.";
    }
    if (code) {
      const label = rejectionBucketTraderGuide(code).meaning;
      const sentence = label.endsWith(".") ? label.slice(0, -1) : label;
      return `Chưa sẵn sàng — ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}.`;
    }
    return `Chưa sẵn sàng — ${body.replace(/\s*\([^)]+\)\s*$/, "")}.`;
  }

  const category = extractCategoryKey(trimmed);
  if (category?.includes("_")) {
    const guide = rejectionBucketTraderGuide(category);
    return `Chưa sẵn sàng — ${guide.meaning}`;
  }

  return formatScannerReasonForUser(trimmed);
}

export function formatRelativeStrengthSummaryForUser(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(RS_SUMMARY_RE);
  if (!match) {
    return formatScannerReasonForUser(trimmed);
  }
  const rs20 = Number.parseFloat(match[1]!);
  const rs50 = match[2] != null ? Number.parseFloat(match[2]) : null;
  const parts: string[] = [];
  if (Number.isFinite(rs20)) {
    parts.push(
      rs20 > 0
        ? `Vượt trội hơn chỉ số trong 20 phiên (${rs20 >= 0 ? "+" : ""}${rs20.toFixed(1)} pp).`
        : rs20 < 0
          ? `Kém hơn chỉ số trong 20 phiên (${rs20.toFixed(1)} pp).`
          : "Ngang bằng chỉ số trong 20 phiên."
    );
  }
  if (rs50 != null && Number.isFinite(rs50)) {
    parts.push(
      rs50 > 0
        ? `RS dài hạn cũng dương (${rs50 >= 0 ? "+" : ""}${rs50.toFixed(1)} pp so với chỉ số).`
        : rs50 < 0
          ? `RS dài hạn đang âm (${rs50.toFixed(1)} pp so với chỉ số).`
          : "RS dài hạn trung tính so với chỉ số."
    );
  }
  return parts.join(" ");
}

export function formatScannerReasonForUser(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw.trim();
  if (!text) return "";

  const failed = text.match(FAILED_GATE2_RE);
  if (failed) return formatGateFailureForUser(text);

  if (RS_SUMMARY_RE.test(text) && text.length < 80) {
    return formatRelativeStrengthSummaryForUser(text);
  }

  const trendOk = text.match(TREND_OK_RE);
  if (trendOk) {
    return "Xu hướng thuận lợi: giá trên đường trung bình 50 ngày và động lượng ngắn hạn đồng thuận.";
  }

  for (const [pattern, replacement] of INTERNAL_PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\s*\([a-z0-9_]+\)\s*/gi, " ");
  text = cleanWhitespace(text);

  if (/^Not in zone$/i.test(text)) {
    return "Giá chưa vào vùng pullback.";
  }

  return text;
}

export function formatRadarReason(raw: string): string {
  return formatScannerReasonForUser(raw);
}

export function formatBreadthSummary(
  latestScan: LatestScanWithCandidates | null,
  gateFunnel: GateFunnelSnapshot | null
): string | null {
  if (gateFunnel) {
    const { qualifiedCountA, qualifiedCountB, surfacedTotal, suppressedTotal } = gateFunnel;
    if (qualifiedCountA === 0 && qualifiedCountB === 0 && surfacedTotal === 0) {
      return null;
    }
    const strong = qualifiedCountA;
    const secondary = qualifiedCountB;
    const surfaced = surfacedTotal;
    let line = `${strong} thiết lập mạnh`;
    if (secondary > 0) {
      line += ` · ${secondary} ứng viên theo dõi`;
    }
    line += ` · ${surfaced} lọt qua bộ lọc chế độ`;
    if (suppressedTotal > 0) {
      line += ` · ${suppressedTotal} bị chặn bởi chế độ`;
    }
    return line;
  }
  if (!latestScan) return null;
  const { candidateCountA, candidateCountB, candidateCountSurfaced } = latestScan;
  if (candidateCountA === 0 && candidateCountB === 0 && candidateCountSurfaced === 0) {
    return null;
  }
  return `${candidateCountA} thiết lập mạnh · ${candidateCountB} ứng viên theo dõi · ${candidateCountSurfaced} đã lọt qua`;
}

export function formatSetupDiagnosticCopy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const formatted = formatScannerReasonForUser(raw);
  return formatted || null;
}

/** Trader-facing action hints — strips internal URLs and setup IDs. */
export function formatActionHintForUser(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/Ghi lệnh — đã xác nhận điểm vào/i.test(trimmed)) return "Ghi lệnh khi điểm vào được xác nhận.";
  if (/Chờ vùng vào lệnh/i.test(trimmed)) return "Chờ vùng vào lệnh pullback.";
  if (/Xem tại Thiết lập/i.test(trimmed)) return "Xem đầy đủ thiết lập tại trang Thiết lập.";
  return formatScannerReasonForUser(trimmed) || null;
}

export function truncateForChip(text: string, max = 48): string {
  const cleaned = text.trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

const NEXT_CONDITION_BY_CODE: Record<string, string> = {
  breakout_recency: "Cần breakout mới",
  pullback_zone_interaction: "Cần vào vùng pullback",
  volume_ratio: "Cần khối lượng xác nhận",
  trend_below_ma50: "Cần xu hướng phục hồi trên đường trung bình 50 ngày",
  trend_ma20_below_ma50: "Cần động lượng ngắn hạn đồng thuận",
  breakout_not_holding: "Cần breakout giữ vững",
  digestion: "Cần tích lũy sau breakout",
};

const STATE_BADGE_BY_CODE: Record<string, { badge: string; tone: V3RsStateTone }> = {
  breakout_recency: { badge: "Watch: breakout", tone: "awaiting" },
  pullback_zone_interaction: { badge: "Blocked: zone", tone: "not-ready" },
  volume_ratio: { badge: "Watch: volume", tone: "watch" },
  trend_below_ma50: { badge: "Blocked: MA50", tone: "not-ready" },
  trend_ma20_below_ma50: { badge: "Watch: momentum", tone: "watch" },
  extension_cap: { badge: "Blocked: extended", tone: "not-ready" },
};

export { buildSetupReason, buildSetupStateLabel, rsStrengthLabelFromRs20 };

function formatRsSpreadChip(label: string, spread: number): V3RsWatchlistMetric {
  const sign = spread >= 0 ? "+" : "";
  return {
    label,
    value: `${sign}${spread.toFixed(1)}pp`,
    tone: spread > 0 ? "strong" : spread < 0 ? "blocker" : "context",
  };
}

function humanizeDiagnosticLine(line: string): string {
  const text = line.trim();
  const rsLine = text.match(/^RS(20|50):\s*([+-]?\d+(?:\.\d+)?)\s*pp vs VNINDEX/i);
  if (rsLine) {
    const spread = Number.parseFloat(rsLine[2]!);
    const sessions = rsLine[1] === "50" ? 50 : 20;
    const dir =
      spread > 0 ? "Vượt trội chỉ số" : spread < 0 ? "Kém hơn chỉ số" : "Ngang bằng chỉ số";
    return `RS ${sessions} phiên: ${dir} (${spread >= 0 ? "+" : ""}${spread.toFixed(1)} pp).`;
  }
  if (/Cổ phiếu trên MA50:\s*có/i.test(text)) return "Xu hướng: trên đường trung bình 50 ngày.";
  if (/Cổ phiếu trên MA50:\s*không/i.test(text)) return "Xu hướng: dưới đường trung bình 50 ngày.";
  if (/VNINDEX trên MA50:\s*có/i.test(text)) return "Bối cảnh thị trường: thuận lợi.";
  if (/VNINDEX trên MA50:\s*không/i.test(text)) return "Bối cảnh thị trường: thận trọng.";
  return formatScannerReasonForUser(text);
}

function metricsFromDiagnostic(row: RsNearMissWatchlistEntryDto): V3RsWatchlistMetric[] {
  const metrics: V3RsWatchlistMetric[] = [
    formatRsSpreadChip("RS20", row.rs20SpreadPct),
  ];
  if (row.rs50SpreadPct != null && Number.isFinite(row.rs50SpreadPct)) {
    metrics.push(formatRsSpreadChip("RS50", row.rs50SpreadPct));
  }

  let trendSet = false;

  for (const line of row.rsDiagnostic?.lines ?? []) {
    if (/Cổ phiếu trên MA50:\s*có/i.test(line)) {
      metrics.push({ label: "Xu hướng", value: "trên MA50", tone: "strong" });
      trendSet = true;
    } else if (/Cổ phiếu trên MA50:\s*không/i.test(line)) {
      metrics.push({ label: "Xu hướng", value: "dưới MA50", tone: "blocker" });
      trendSet = true;
    }
    if (/VNINDEX trên MA50:\s*có/i.test(line)) {
      metrics.push({ label: "Thị trường", value: "thuận lợi", tone: "context" });
    } else if (/VNINDEX trên MA50:\s*không/i.test(line)) {
      metrics.push({ label: "Thị trường", value: "thận trọng", tone: "watch" });
    }
  }

  metrics.push({ label: "Kích hoạt", value: "chưa xác nhận", tone: "watch" });

  if (!trendSet && row.rs20SpreadPct > 0) {
    metrics.push({ label: "Xu hướng", value: "RS dương", tone: "context" });
  }

  return metrics.slice(0, 5);
}

function buildPrimaryInsight(row: RsNearMissWatchlistEntryDto): string {
  const code = row.terminalCode ?? extractCategoryKey(row.failedGate2Because);
  const rsPositive = row.rs20SpreadPct > 0;

  if (code === "breakout_recency" && rsPositive) {
    return "Sức mạnh tương đối tốt, nhưng chưa có breakout mới.";
  }
  if (code === "pullback_zone_interaction" && rsPositive) {
    return "Vượt trội hơn VNINDEX, đang chờ điểm kích hoạt vào lệnh rõ ràng.";
  }
  if (code === "volume_ratio" && rsPositive) {
    return "Sức mạnh tương đối đang hình thành, nhưng khối lượng tham gia còn mỏng.";
  }
  if (code === "trend_below_ma50" && rsPositive) {
    return "RS dương, nhưng giá vẫn dưới bộ lọc xu hướng dài hạn.";
  }
  if (rsPositive) {
    return "Vượt trội hơn VNINDEX — chưa vượt qua bộ lọc thiết lập.";
  }
  if (code) {
    const guide = rejectionBucketTraderGuide(code);
    const meaning = guide.meaning.endsWith(".") ? guide.meaning.slice(0, -1) : guide.meaning;
    return meaning.charAt(0).toUpperCase() + meaning.slice(1) + ".";
  }
  return formatGateFailureForUser(row.failedGate2Because);
}

function buildNextCondition(row: RsNearMissWatchlistEntryDto): string {
  const code = row.terminalCode ?? extractCategoryKey(row.failedGate2Because);
  if (code && NEXT_CONDITION_BY_CODE[code]) {
    return NEXT_CONDITION_BY_CODE[code]!;
  }
  if (code) {
    const guide = rejectionBucketTraderGuide(code);
    const wait = guide.waitFor;
    if (wait.length <= 72) return wait.endsWith(".") ? wait.slice(0, -1) : wait;
    return "Theo dõi đến khi cấu trúc cải thiện trước khi hành động.";
  }
  return "Chỉ theo dõi — chưa phải thiết lập đạt chuẩn.";
}

function buildTechnicalEvidence(row: RsNearMissWatchlistEntryDto): string[] {
  const lines: string[] = [];
  if (row.rsDiagnostic?.lines.length) {
    for (const line of row.rsDiagnostic.lines) {
      lines.push(humanizeDiagnosticLine(line));
    }
  }
  if (row.failedGate2Because) {
    lines.push(formatGateFailureForUser(row.failedGate2Because));
  }
  if (
    row.distanceToPullbackZoneFrac != null &&
    Number.isFinite(row.distanceToPullbackZoneFrac)
  ) {
    lines.push(
      `Khoảng cách đến vùng pullback: ${(100 * row.distanceToPullbackZoneFrac).toFixed(1)}% (chỉ để tham khảo).`
    );
  }
  if (row.rsDiagnostic?.disclaimer) {
    lines.push(
      "Sức mạnh tương đối chỉ để tham khảo. Hiện chưa xác nhận thiết lập đạt chuẩn."
    );
  }
  return [...new Set(lines.filter(Boolean))];
}

function humanizeTargetReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const labels: Record<string, string> = {
    resistance_cluster: "Vùng kháng cự",
    prior_60d_high: "Đỉnh 60 ngày",
    prior_20d_high: "Đỉnh 20 ngày",
    pivot_high: "Đỉnh pivot",
    congestion_ceiling: "Trần tích lũy",
    atr_floor: "Mục tiêu tối thiểu theo ATR",
    pct_floor: "Mục tiêu % tối thiểu",
  };
  return labels[reason] ?? reason.replace(/_/g, " ");
}

function humanizeInvalidReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const labels: Record<string, string> = {
    swing_low: "Đáy swing gần nhất",
    compression_low: "Đáy tích lũy",
    reclaim_candle_low: "Đáy nến reclaim",
    ma20_failure: "Thủng MA20",
    ma50_failure: "Thủng MA50",
    atr_stop_floor: "Cắt lỗ tối thiểu theo ATR",
  };
  return labels[reason] ?? reason.replace(/_/g, " ");
}

function mapEarlyEntryToV3(entry: EarlyEntryDisplayMetadata | null | undefined): V3EarlyEntryDisplay | null {
  if (!entry) return null;
  return {
    earlyReversalScore: entry.earlyReversalScore,
    proposedTradeState: tradeStateDisplayLabel(entry.proposedTradeState),
    entryType: entry.entryType,
    reasonCodes: [...entry.reasonCodes],
    transitionReasonCodes: [...entry.transitionReasonCodes],
    invalidLevel: entry.invalidLevel,
    invalidLevelReason: humanizeInvalidReason(entry.invalidLevelReason),
    stopDistancePct: entry.stopDistancePct,
    targetPrice: entry.targetPrice,
    targetReason: humanizeTargetReason(entry.targetReason),
    estimatedRewardPct: entry.estimatedRewardPct,
    estimatedRiskReward: entry.estimatedRiskReward,
    suggestedPilotSizePct: entry.suggestedPilotSizePct,
    sizingNote: entry.sizingNote,
    whyNotPilotYet: entry.whyNotPilotYet,
    rrRejectionReason: entry.rrRejectionReason,
    distFromMa20Pct: entry.distFromMa20Pct,
  };
}

export function mapRsWatchlistEntryToV3Card(
  row: RsNearMissWatchlistEntryDto,
  scoring?: { rsStrengthScore: number; setupReadinessScore: number; rsConfidence: string } | null
): V3RsWatchlistCard {
  const code = row.terminalCode ?? extractCategoryKey(row.failedGate2Because) ?? "";
  const state =
    STATE_BADGE_BY_CODE[code] ?? ({ badge: "Watch: monitor", tone: "watch" } as const);
  const setupState = buildSetupStateLabel(code || null);
  const setupReason = buildSetupReason(row);

  return {
    symbol: row.symbol,
    rs20SpreadPct: row.rs20SpreadPct,
    rs50SpreadPct: row.rs50SpreadPct,
    stateBadge: state.badge,
    stateTone: state.tone,
    setupState,
    setupReason,
    strengthLabel: rsStrengthLabelFromRs20(row.rs20SpreadPct),
    primaryInsight: buildPrimaryInsight(row),
    metrics: metricsFromDiagnostic(row),
    blockerLabel: setupReason,
    nextCondition: buildNextCondition(row),
    technicalEvidence: buildTechnicalEvidence(row),
    rsStrengthScore: scoring?.rsStrengthScore ?? null,
    setupReadinessScore: scoring?.setupReadinessScore ?? null,
    rsConfidence: (scoring?.rsConfidence as V3RsWatchlistCard["rsConfidence"]) ?? null,
    terminalCode: code || null,
    earlyEntry: mapEarlyEntryToV3(row.earlyEntry),
  };
}

export function mapRsWatchlistToV3Panel(
  panel: RsNearMissWatchlistPanelDto,
  options?: {
    scoringBySymbol?: ReadonlyMap<
      string,
      { rsStrengthScore: number; setupReadinessScore: number; rsConfidence: string }
    >;
  }
): V3RsWatchlistPanel {
  return {
    title: "Radar sức mạnh tương đối",
    subtitle: "Các mã dẫn dắt so với VNINDEX nhưng chưa vượt qua bộ lọc thiết lập.",
    contextNote:
      "Chỉ để tham khảo — sức mạnh tương đối không xác nhận thiết lập và không thay đổi lập trường hôm nay.",
    cards: panel.rows.map((row) =>
      mapRsWatchlistEntryToV3Card(row, options?.scoringBySymbol?.get(row.symbol) ?? null)
    ),
    emptyReason: panel.emptyReason
      ? formatScannerReasonForUser(panel.emptyReason)
      : null,
  };
}

/** @deprecated Use mapRsWatchlistToV3Panel — kept for transitional imports. */
export function humanizeRsNearMissWatchlistPanel(
  panel: RsNearMissWatchlistPanelDto
): RsNearMissWatchlistPanelDto {
  return {
    title: "Danh sách theo dõi sức mạnh tương đối",
    subtitle:
      "Các mã dẫn dắt so với chỉ số nhưng trượt bộ lọc thiết lập — chỉ để tham khảo, không phải tín hiệu giao dịch.",
    disclaimerLines: [
      "Chỉ để theo dõi — không tính là thiết lập đạt chuẩn.",
      "Không thay đổi quyết định giao dịch hôm nay.",
    ],
    actionHint: "Xem để tham khảo; chờ bộ lọc thiết lập thông qua trước khi hành động.",
    emptyReason: panel.emptyReason
      ? formatScannerReasonForUser(panel.emptyReason)
      : null,
    rows: panel.rows.map((row) => ({
      ...row,
      failedGate2Because: formatGateFailureForUser(row.failedGate2Because),
      topRejectionReason: row.topRejectionReason
        ? formatScannerReasonForUser(row.topRejectionReason)
        : "",
      actionHint: "Chỉ để theo dõi — không phải thiết lập đạt chuẩn.",
      disclaimerLines: [
        "Chỉ để tham khảo — không phải tín hiệu giao dịch.",
        "Không ảnh hưởng đến điểm số thiết lập.",
      ],
      rsDiagnostic: row.rsDiagnostic
        ? {
            ...row.rsDiagnostic,
            summary: formatRelativeStrengthSummaryForUser(row.rsDiagnostic.summary),
            disclaimer:
              "Sức mạnh tương đối chỉ hiển thị để tham khảo. Không quyết định điểm số thiết lập.",
            lines: row.rsDiagnostic.lines.map((line) => formatScannerReasonForUser(line)),
          }
        : null,
    })),
  };
}
