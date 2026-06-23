import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildPaperSafetySummary,
  type PaperSafetySummary,
} from "@/lib/scanner/early-entry/paper-signals";

export type PaperValidationSummaryUi = {
  openLiveSignals: number;
  resolvedLivePilots: number;
  pilotFalseRatePct: number | null;
  extendedAvoidanceRate5d: number | null;
  statusLabel: "CONTINUE_PAPER_VALIDATION" | "READY_FOR_REVIEW";
  available: boolean;
};

export async function loadPaperValidationSummary(): Promise<PaperValidationSummaryUi> {
  const empty: PaperValidationSummaryUi = {
    openLiveSignals: 0,
    resolvedLivePilots: 0,
    pilotFalseRatePct: null,
    extendedAvoidanceRate5d: null,
    statusLabel: "CONTINUE_PAPER_VALIDATION",
    available: false,
  };

  try {
    const filePath = path.join(
      process.cwd(),
      "docs",
      "trading",
      "evidence",
      "early-entry-paper-signals.json"
    );
    const raw = await readFile(filePath, "utf8");
    const store = JSON.parse(raw) as Parameters<typeof buildPaperSafetySummary>[0];
    const summary: PaperSafetySummary = buildPaperSafetySummary(store);
    const resolved = summary.resolvedLivePilots.baseline ?? 0;
    const falseRate = summary.falseRateByVariant.baseline;
    return {
      openLiveSignals: summary.openLiveSignals,
      resolvedLivePilots: resolved,
      pilotFalseRatePct: falseRate != null ? Math.round(falseRate * 1000) / 10 : null,
      extendedAvoidanceRate5d:
        summary.extendedAvoidanceRate5d != null
          ? Math.round(summary.extendedAvoidanceRate5d * 1000) / 10
          : null,
      statusLabel: summary.anyVariantReady ? "READY_FOR_REVIEW" : "CONTINUE_PAPER_VALIDATION",
      available: true,
    };
  } catch {
    return empty;
  }
}
