import type { Gate1Level } from "./gate2/types";

/** Persisted on `DailyScanRun.notes.decision` and shown on /setups. */
export type DailyTradingDecisionLevel = "NO_TRADE" | "PROBE" | "NORMAL";

export type DailyTradingDecision = {
  level: DailyTradingDecisionLevel;
  allocation: string;
  explanation: string;
};

function hasAnyGate2Setup(candidateCountA: number, candidateCountB: number): boolean {
  return candidateCountA > 0 || candidateCountB > 0;
}

/**
 * Daily exposure stance from Gate 1 regime × Gate 2 A/B counts (counts are pre–Gate 1 surfacing).
 * Conservative by design: no AGGRESSIVE tier until sizing / risk limits exist.
 */
export function computeDailyTradingDecision(params: {
  gate1Level: Gate1Level;
  candidateCountA: number;
  candidateCountB: number;
}): DailyTradingDecision {
  const { gate1Level, candidateCountA, candidateCountB } = params;

  if (gate1Level === "FAIL") {
    return {
      level: "NO_TRADE",
      allocation: "0%",
      explanation: "Điều kiện thị trường không thuận lợi.",
    };
  }

  if (gate1Level === "PASS") {
    if (hasAnyGate2Setup(candidateCountA, candidateCountB)) {
      return {
        level: "NORMAL",
        allocation: "50-70%",
        explanation: "Thị trường đang hỗ trợ và có thiết lập hợp lệ.",
      };
    }
    return {
      level: "NO_TRADE",
      allocation: "0%",
      explanation: "Thị trường đang hỗ trợ, nhưng không có thiết lập hợp lệ nào.",
    };
  }

  // WARNING
  if (candidateCountA > 0) {
    return {
      level: "PROBE",
      allocation: "20-40%",
      explanation: "Chỉ được phép vào lệnh nhỏ vì điều kiện thị trường đang lẫn lộn.",
    };
  }

  return {
    level: "NO_TRADE",
    allocation: "0%",
    explanation: "Thị trường đang lẫn lộn và không có thiết lập Hạng A.",
  };
}

/** Persisted JSON shape under `notes.decision`. */
export function toPersistedDailyDecision(d: DailyTradingDecision): {
  level: DailyTradingDecisionLevel;
  allocation: string;
  explanation: string;
} {
  return {
    level: d.level,
    allocation: d.allocation,
    explanation: d.explanation,
  };
}

const LEVELS: readonly DailyTradingDecisionLevel[] = ["NO_TRADE", "PROBE", "NORMAL"];

/** Legacy scans may still have AGGRESSIVE — map to current NORMAL guidance. */
function normalizeLegacyAggressive(): DailyTradingDecision {
  return {
    level: "NORMAL",
    allocation: "50-70%",
    explanation: "Thị trường đang hỗ trợ và có thiết lập hợp lệ.",
  };
}

export function parsePersistedDailyDecision(raw: unknown): DailyTradingDecision | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const level = o.level;
  const allocation = o.allocation;
  const explanation = o.explanation;

  if (level === "AGGRESSIVE") {
    return normalizeLegacyAggressive();
  }

  if (typeof level !== "string" || !LEVELS.includes(level as DailyTradingDecisionLevel)) return null;
  if (typeof allocation !== "string" || allocation.length === 0) return null;
  if (typeof explanation !== "string" || explanation.length === 0) return null;
  return {
    level: level as DailyTradingDecisionLevel,
    allocation,
    explanation,
  };
}

/** Display line for UI headings (e.g. NO_TRADE → "NO TRADE"). */
export function formatDecisionLevelForDisplay(level: DailyTradingDecisionLevel): string {
  return level.replace(/_/g, " ");
}
