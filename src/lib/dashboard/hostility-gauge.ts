import type { Gate1Level } from "@/lib/scanner/gate2/types";

export type HostilityGaugeTone = "calm" | "caution" | "hostile";

export type HostilityGaugeDto = {
  /** 0-100 illustrative dial position — NOT a computed composite risk score. */
  score: number;
  label: string;
  tone: HostilityGaugeTone;
};

/**
 * Maps the existing categorical Gate1Level (PASS/WARNING/FAIL) to a fixed,
 * illustrative gauge position + color zone for the mockup's "Hostility Index"
 * dial. This is presentation-only: there is no composite numeric hostility
 * score computed anywhere in the app, and this function does not invent one —
 * each Gate1Level maps to one fixed dial position, chosen only so the needle
 * lands visibly inside its zone's colored band, not a measurement.
 */
export function resolveHostilityGauge(gate1: Gate1Level): HostilityGaugeDto {
  switch (gate1) {
    case "PASS":
      return { score: 20, label: "Calm", tone: "calm" };
    case "WARNING":
      return { score: 55, label: "Caution", tone: "caution" };
    case "FAIL":
      return { score: 85, label: "Hostile", tone: "hostile" };
    default:
      return { score: 55, label: "Caution", tone: "caution" };
  }
}
