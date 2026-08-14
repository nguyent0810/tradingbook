/**
 * D0 — market risk budget. SHADOW ONLY.
 *
 * D0 is upstream of everything and is the only place the market may speak. It
 * maps the existing Gate 1 level to a symbolic risk class.
 *
 * NO FRACTION IS CHOSEN HERE. Not 0.25R, not 0.5%, not a portfolio percentage.
 * §3 of the M1 brief forbids picking a ladder, and the whole point of M1 is that
 * a symbolic class is enough to observe the architecture without committing to a
 * number that would need its own evidence.
 *
 * The mapping reuses semantics already in the repo (`computeDailyTradingDecision`
 * treats FAIL as no trade, WARNING as reduced, PASS as normal). It is a
 * restatement of what production already believes, not a new claim.
 */
import type { MarketRiskInput, MarketRiskOutput } from "./contracts";

export function decideMarketRisk(input: MarketRiskInput): MarketRiskOutput {
  switch (input.gate1Level) {
    case "FAIL":
      return {
        riskClass: "NONE",
        usage: "SHADOW_ONLY",
        reasons: ["gate1_fail"],
      };
    case "WARNING":
      return {
        riskClass: "REDUCED",
        usage: "SHADOW_ONLY",
        reasons: ["gate1_warning"],
      };
    case "PASS":
      return {
        riskClass: "NORMAL",
        usage: "SHADOW_ONLY",
        reasons: ["gate1_pass"],
      };
  }
}
