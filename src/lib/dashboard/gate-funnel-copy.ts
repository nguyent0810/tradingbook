import type { Gate1Level } from "@/lib/scanner/gate2/types";
import { deriveGate1SurfacingRule } from "@/lib/scanner/gate2/collect-candidates";
import type { DailyTradingDecisionLevel } from "@/lib/scanner/trading-decision";

/** Scan row counts used for Gate 2 qualified vs Gate 1 surfaced breakdown. */
export type GateFunnelScanCounts = {
  candidateCountA: number;
  candidateCountB: number;
  candidateCountSurfaced: number;
};

/**
 * Gate 2 qualified (pre–Gate 1) vs surfaced (post–Gate 1) by tier.
 * Surfaced tier split follows `deriveGate1SurfacingRule` (shared with the
 * scan-time filter in `collect-candidates.ts`), reconstructed here from the
 * persisted aggregate counts since per-tier surfaced counts aren't persisted.
 */
export type GateFunnelSnapshot = {
  gate1Level: Gate1Level;
  qualifiedCountA: number;
  qualifiedCountB: number;
  qualifiedTotal: number;
  surfacedCountA: number;
  surfacedCountB: number;
  surfacedTotal: number;
  suppressedCountA: number;
  suppressedCountB: number;
  suppressedTotal: number;
};

export function computeGateFunnelSnapshot(
  scan: GateFunnelScanCounts,
  gate1Level: Gate1Level
): GateFunnelSnapshot {
  const qualifiedCountA = scan.candidateCountA;
  const qualifiedCountB = scan.candidateCountB;
  const qualifiedTotal = qualifiedCountA + qualifiedCountB;

  const rule = deriveGate1SurfacingRule(gate1Level);

  let surfacedCountA = 0;
  let surfacedCountB = 0;

  if (rule === "tier-a-only") {
    surfacedCountA = Math.min(qualifiedCountA, scan.candidateCountSurfaced);
  } else if (rule === "all") {
    surfacedCountA = Math.min(qualifiedCountA, scan.candidateCountSurfaced);
    const remainder = Math.max(0, scan.candidateCountSurfaced - surfacedCountA);
    surfacedCountB = Math.min(qualifiedCountB, remainder);
  }

  const surfacedTotal = surfacedCountA + surfacedCountB;
  const suppressedCountA = Math.max(0, qualifiedCountA - surfacedCountA);
  const suppressedCountB = Math.max(0, qualifiedCountB - surfacedCountB);

  return {
    gate1Level,
    qualifiedCountA,
    qualifiedCountB,
    qualifiedTotal,
    surfacedCountA,
    surfacedCountB,
    surfacedTotal,
    suppressedCountA,
    suppressedCountB,
    suppressedTotal: suppressedCountA + suppressedCountB,
  };
}

export function formatGateFunnelSummaryLine(funnel: GateFunnelSnapshot): string {
  const parts = [
    `Đạt Gate 2 (trước chế độ): A ${funnel.qualifiedCountA} · B ${funnel.qualifiedCountB}`,
    `Đã lọc ra sau Gate 1: ${funnel.surfacedTotal}`,
  ];
  if (funnel.suppressedTotal > 0) {
    parts.push(
      `Bị chặn bởi Gate 1: ${funnel.suppressedTotal}` +
        (funnel.suppressedCountB > 0
          ? ` (gồm ${funnel.suppressedCountB} Hạng B)`
          : funnel.suppressedCountA > 0
            ? ` (gồm ${funnel.suppressedCountA} Hạng A)`
            : "")
    );
  }
  return parts.join(" · ");
}

export type VerdictUxCopy = {
  headline: string;
  subtitle: string;
  persistedLevelNote: string;
};

/** UX labels for persisted stance vs dashboard action mode (Batch F). */
export function buildVerdictUxCopy(params: {
  uxLevel: "NO_TRADE" | "PROBE" | "TRADE";
  persistedLevel: DailyTradingDecisionLevel;
  gate1: Gate1Level;
  funnel: GateFunnelSnapshot;
}): VerdictUxCopy {
  const { uxLevel, persistedLevel, gate1, funnel } = params;

  const persistedLevelNote =
    persistedLevel === "NORMAL"
      ? "Trạng thái đã ghi nhận: NORMAL (chế độ rủi ro sổ lệnh bình thường)"
      : persistedLevel === "PROBE"
        ? "Trạng thái đã ghi nhận: PROBE (chế độ rủi ro sổ lệnh giảm)"
        : "Trạng thái đã ghi nhận: NO_TRADE (giới hạn sổ lệnh 0%)";

  if (uxLevel === "TRADE") {
    return {
      headline: "TRADE MODE",
      subtitle:
        "Chế độ rủi ro bình thường — các thiết lập đã đạt Gate 2 và chế độ thị trường cho phép định cỡ vị thế. Đây không phải là chỉ thị tự động vào lệnh mọi mã.",
      persistedLevelNote,
    };
  }

  if (uxLevel === "PROBE") {
    const bHidden =
      funnel.suppressedCountB > 0
        ? ` Hạng B (${funnel.suppressedCountB}) đã đạt Gate 2 nhưng đang bị ẩn khi Gate 1 là ${gate1}.`
        : "";
    return {
      headline: "WATCH",
      subtitle:
        `Chế độ rủi ro sổ lệnh giảm — chỉ các thiết lập Hạng A được hiển thị khi Gate 1 thận trọng.${bHidden} Không phải ngày giao dịch toàn lực.`,
      persistedLevelNote,
    };
  }

  const suppressedNote =
    funnel.suppressedTotal > 0
      ? ` ${funnel.suppressedTotal} thiết lập đã đạt Gate 2 bị chặn bởi Gate 1 (${gate1}).`
      : "";
  return {
    headline: "NO TRADE",
    subtitle: `Bảo toàn vốn — không vào lệnh swing mới theo trạng thái hiện tại.${suppressedNote}`,
    persistedLevelNote,
  };
}
