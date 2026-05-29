import type { Gate2RankComponents } from "@/lib/scanner/gate2/rank-components";

export const SETUP_CANDIDATE_REASONS_VERSION = 1 as const;

export type SetupCandidateReasonsPayloadV1 = {
  v: typeof SETUP_CANDIDATE_REASONS_VERSION;
  lines: string[];
  rankComponents?: Gate2RankComponents;
};

export type ParsedSetupCandidateReasons = {
  lines: string[];
  rankComponents: Gate2RankComponents | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseRankComponents(raw: unknown): Gate2RankComponents | null {
  if (!isRecord(raw)) return null;
  const nums = [
    raw.volumeTerm,
    raw.extensionTerm,
    raw.maDistanceTerm,
    raw.depthPenalty,
    raw.rankScore,
  ];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const inputs = raw.inputs;
  if (!isRecord(inputs)) return null;
  const inputNums = [
    inputs.volRatio,
    inputs.extensionPct,
    inputs.maDistancePct,
    inputs.depthFrac,
  ];
  if (!inputNums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    volumeTerm: raw.volumeTerm as number,
    extensionTerm: raw.extensionTerm as number,
    maDistanceTerm: raw.maDistanceTerm as number,
    depthPenalty: raw.depthPenalty as number,
    rankScore: raw.rankScore as number,
    inputs: {
      volRatio: inputs.volRatio as number,
      extensionPct: inputs.extensionPct as number,
      maDistancePct: inputs.maDistancePct as number,
      depthFrac: inputs.depthFrac as number,
    },
  };
}

/**
 * Parse `SetupCandidate.reasons` JSON — legacy string[] or v1 object payload.
 */
export function parseSetupCandidateReasons(raw: unknown): ParsedSetupCandidateReasons {
  if (Array.isArray(raw)) {
    return {
      lines: raw.filter((x): x is string => typeof x === "string"),
      rankComponents: null,
    };
  }
  if (isRecord(raw) && raw.v === SETUP_CANDIDATE_REASONS_VERSION && Array.isArray(raw.lines)) {
    return {
      lines: raw.lines.filter((x): x is string => typeof x === "string"),
      rankComponents: parseRankComponents(raw.rankComponents),
    };
  }
  return { lines: [], rankComponents: null };
}

/**
 * Serialize for Prisma `Json` — keeps legacy array shape when no rank breakdown.
 */
export function serializeSetupCandidateReasons(
  lines: readonly string[],
  rankComponents?: Gate2RankComponents | null
): string[] | SetupCandidateReasonsPayloadV1 {
  if (!rankComponents) {
    return [...lines];
  }
  return {
    v: SETUP_CANDIDATE_REASONS_VERSION,
    lines: [...lines],
    rankComponents,
  };
}
