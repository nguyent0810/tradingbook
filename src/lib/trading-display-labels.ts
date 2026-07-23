/**
 * User-facing labels for scanner/trading enums. Internal enum strings stay unchanged.
 */

import type { ClosestExecutionStatus } from "@/lib/scanner/closest-execution-metrics";

const SCAN_SETUP_TYPE_LABELS: Record<string, string> = {
  BREAKOUT_PULLBACK: "Breakout-pullback",
};

const MOMENTUM_LABELS: Record<string, string> = {
  FRESH_BREAKOUT: "Breakout mới",
  MOMENTUM_IGNITION: "Bùng nổ động lượng",
  RECLAIM_THRUST: "Bứt phá giành lại",
  EXTENDED_NO_PULLBACK: "Mở rộng không pullback",
  FAILED_BREAKOUT_RISK: "Rủi ro breakout thất bại",
};

const MOMENTUM_RISK_LABELS: Record<string, string> = {
  STOP_FAR: "Dừng lỗ quá xa",
  EXTENDED: "Đã mở rộng",
  LOW_LIQUIDITY: "Thanh khoản thấp",
  BELOW_MA50: "Dưới MA50",
  NO_PULLBACK: "Không có pullback",
  STALE_DATA: "Dữ liệu cũ",
};

const MOMENTUM_GROUP_LABELS: Record<string, string> = {
  ACTIONABLE_WATCH: "Theo dõi có thể hành động",
  EXTENDED_WATCH_ONLY: "Chỉ theo dõi mở rộng",
  AVOID_RISK: "Tránh rủi ro",
  COVERAGE_TRADABILITY_BLOCKED: "Bị chặn điều kiện giao dịch",
};

const SETUP_LIFECYCLE_LABELS: Record<string, string> = {
  NEW: "Mới",
  WATCHING: "Đang theo dõi pullback",
  READY: "Tại vùng vào lệnh",
  TRIGGERED: "Đã kích hoạt",
  EXPIRED: "Đã hết hạn",
  INVALID: "Không hợp lệ",
};

function titleCaseWords(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** Playbook / persisted scan setup type keys (e.g. BREAKOUT_PULLBACK). */
export function displayScanSetupTypeKey(raw: string): string {
  return SCAN_SETUP_TYPE_LABELS[raw] ?? titleCaseWords(raw);
}

/** Gate 2 proximity execution status (READY / WAIT / INVALID). */
export function displayClosestExecutionStatus(status: ClosestExecutionStatus): string {
  switch (status) {
    case "READY":
      return "Tại vùng vào lệnh";
    case "WAIT":
      return "Đang chờ pullback";
    case "INVALID":
      return "Cấu trúc không hợp lệ";
    default:
      return titleCaseWords(String(status));
  }
}

/**
 * Near-miss / closest-invalid rows — avoid sounding like a trade signal.
 * Internal status enum unchanged; display-only (Batch F).
 */
export function displayNearMissDiagnosticStatus(status: ClosestExecutionStatus): string {
  switch (status) {
    case "READY":
      return "Trong vùng (chỉ chẩn đoán)";
    case "WAIT":
      return "Gần thiết lập, chưa xác thực";
    case "INVALID":
      return "Cấu trúc không hợp lệ (chỉ theo dõi)";
    default:
      return titleCaseWords(String(status));
  }
}

/** Action hint for near-miss diagnostics (not SetupCandidate trade signals). */
export function nearMissDiagnosticActionHint(status: ClosestExecutionStatus): string {
  switch (status) {
    case "READY":
      return "Chỉ chẩn đoán — giá đang nằm trong vùng pullback nhưng Gate 2 chưa xác thực. Không phải tín hiệu giao dịch.";
    case "WAIT":
      return "Chỉ theo dõi — mã gần INVALID nhất; chờ quy tắc mẫu hình hoặc bối cảnh thị trường cải thiện.";
    case "INVALID":
      return "Không giao dịch — cấu trúc không đạt Gate 2 với mẫu hình này.";
  }
}

/**
 * Surfaced candidate lifecycle strip (READY | WATCHING from health view).
 * Left in English (localization pass, 2026-07): `setup-lifecycle-dto.test.ts`
 * asserts these exact literal strings and is out of scope for this pass —
 * translating here without updating that test would silently desync it.
 */
export function displayCandidateLifecycleSortLabel(label: "READY" | "WATCHING"): string {
  return label === "READY" ? "At entry zone" : "Waiting for pullback";
}

/** Momentum audit row labels (e.g. FRESH_BREAKOUT). */
export function displayMomentumLabel(raw: string): string {
  return MOMENTUM_LABELS[raw] ?? titleCaseWords(raw);
}

/** Momentum audit risk annotations (e.g. STOP_FAR). */
export function displayMomentumRiskAnnotation(raw: string): string {
  return MOMENTUM_RISK_LABELS[raw] ?? titleCaseWords(raw);
}

/** Momentum audit grouping (e.g. ACTIONABLE_WATCH). */
export function displayMomentumAuditGroup(raw: string): string {
  return MOMENTUM_GROUP_LABELS[raw] ?? titleCaseWords(raw);
}

/** Watchlist / DB lifecycle status. */
export function displaySetupLifecycleStatus(raw: string): string {
  return SETUP_LIFECYCLE_LABELS[raw] ?? titleCaseWords(raw);
}

export function displayScanQualityTier(quality: string): string {
  if (quality === "A") return "Hạng A";
  if (quality === "B") return "Hạng B";
  return quality;
}

/** Scan run row status (DailyScanRun.status). */
export function displayDailyScanRunStatus(raw: string): string {
  switch (raw) {
    case "COMPLETED":
      return "Đã hoàn tất";
    case "FAILED":
      return "Thất bại";
    default:
      return titleCaseWords(raw);
  }
}

/**
 * Gate 1 market / scan regime level (PASS / WARNING / FAIL).
 * Left in English (localization pass, 2026-07): `pipeline-stages.ts` and
 * `dashboard-evidence-compact.tsx` (components, out of scope for this pass)
 * do `.toLowerCase().includes("favorable"/"caution"/"hostile")` style checks
 * against this exact output to derive tone/styling — translating here would
 * silently break that logic without a same-pass update to those files.
 */
export function displayGate1ScanLevel(raw: string): string {
  switch (raw) {
    case "PASS":
      return "Favorable";
    case "WARNING":
      return "Caution";
    case "FAIL":
      return "Hostile";
    default:
      return titleCaseWords(raw);
  }
}

const UNIVERSE_SOURCE_LABELS: Record<string, string> = {
  CORE: "Vũ trụ chính",
  TACTICAL: "Theo dõi chiến thuật",
  BOTH: "Chính + chiến thuật",
};

export function displayUniverseSource(raw: string): string {
  return UNIVERSE_SOURCE_LABELS[raw] ?? titleCaseWords(raw);
}

export function displayTradeStatus(raw: string): string {
  switch (raw) {
    case "OPEN":
      return "Đang mở";
    case "CLOSED":
      return "Đã hoàn tất";
    case "CANCELLED":
      return "Đã hủy";
    case "PLANNED":
      return "Đã lên kế hoạch";
    default:
      return titleCaseWords(raw);
  }
}

export function displayTradeDirection(raw: string): string {
  switch (raw) {
    case "LONG":
      return "Thiên hướng mua";
    case "SHORT":
      return "Thiên hướng bán";
    default:
      return titleCaseWords(raw);
  }
}

const SETUP_HEALTH_LEVEL_LABELS: Record<string, string> = {
  HEALTHY: "Khỏe mạnh",
  WARNING: "Cần theo dõi",
  AT_RISK: "Có rủi ro",
  DEAD: "Đã hỏng",
  NO_DATA: "Không có dữ liệu",
};

/** Setup watch health level (scanner watch items). */
export function displaySetupHealthLevel(raw: string): string {
  return SETUP_HEALTH_LEVEL_LABELS[raw] ?? titleCaseWords(raw);
}

/** Tradability breakdown keys from persisted scan JSON (internal ids → readable line). */
export function displayTradabilityBreakdownKey(raw: string): string {
  const spaced = raw
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return raw;
  return spaced
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
