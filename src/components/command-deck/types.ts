export type RadarNodeClassification = "actionable" | "watch" | "avoid";

export type RadarNode = {
  symbol: string;
  readiness: number;
  risk: number;
  classification: RadarNodeClassification;
  tier: string;
  reason: string;
  sparkline: number[];
};

export type RelativeStrengthRow = {
  symbol: string;
  rs20: number;
  rs50: number | null;
  rsStrength: string;
  setupState: string;
  reason: string;
  /** @deprecated Use setupState */
  status: "watch" | "blocked" | "aligned";
  rsStrengthScore: number | null;
  setupReadinessScore: number | null;
  terminalCode: string | null;
  sectorLabel: string;
  actionLabel: string;
  /** Display-only early-entry lane when EARLY_ENTRY_V1_ENABLED */
  earlyEntry?: import("@/lib/dashboard/dashboard-v3-view-model").V3EarlyEntryDisplay | null;
};
