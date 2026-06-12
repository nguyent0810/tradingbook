import type { CommandDeckMockData } from "../types";

/** Production-like NO TRADE fixture — VNINDEX session with live regime mismatch. */
export const COMMAND_DECK_MOCK: CommandDeckMockData = {
  commandBar: {
    session: "VNINDEX EOD · 2026-05-25",
    vnindex: "1,245.50",
    freshness: "Scan 2026-05-25",
    regime: "Favorable (scan)",
    regimeNote: "Scan tagged Favorable, live Caution — no new entries today",
    breadth: "—",
    volatility: "Momentum up",
    watchState: "2 symbols on watch",
    stats: [
      { label: "Foreign 1D", value: "−441.39B ₫", tone: "danger" },
      { label: "Foreign cov.", value: "183/229 OK", tone: "success" },
    ],
  },
  decision: {
    stance: "NO TRADE",
    stanceTone: "danger",
    confidenceLabel: "Medium confidence",
    primaryReason:
      "Preserve capital — no new swing entries under current stance. Live VNINDEX has weakened to Caution since the scan.",
    mainRisk:
      "Live regime is Caution while the scan was Favorable — prioritize capital preservation until conditions realign.",
    mainRiskPercent: 78,
    capital: "No new swing risk — 0% book cap. Avoid chase on extended names.",
    capitalPercent: 12,
    nextAction:
      "Do not enter new trades today. Open the pipeline to see near-miss names and wait for the next scan.",
  },
  radar: [
    {
      symbol: "VJC",
      readiness: 72,
      risk: 38,
      classification: "watch",
      tier: "Near-miss",
      reason: "Pullback zone interaction — not at entry box",
      sparkline: [42, 48, 51, 55, 58, 62],
    },
    {
      symbol: "ACB",
      readiness: 65,
      risk: 52,
      classification: "watch",
      tier: "Near-miss",
      reason: "Extended above breakout — chase risk elevated",
      sparkline: [38, 40, 44, 47, 50, 52],
    },
    {
      symbol: "BSR",
      readiness: 58,
      risk: 61,
      classification: "avoid",
      tier: "Rejected",
      reason: "Volume participation below median",
      sparkline: [55, 52, 48, 45, 42, 40],
    },
    {
      symbol: "HPG",
      readiness: 81,
      risk: 44,
      classification: "watch",
      tier: "Closest",
      reason: "Near pullback box — awaiting interaction bar",
      sparkline: [50, 58, 62, 68, 74, 81],
    },
  ],
  relativeStrength: [
    { symbol: "ABB", rs20: 4.2, vsIndex: "+4.2%", status: "watch", sparkline: [1.1, 1.8, 2.4, 3.1, 3.8, 4.2] },
    { symbol: "VND", rs20: 3.1, vsIndex: "+3.1%", status: "watch", sparkline: [0.8, 1.2, 1.9, 2.3, 2.8, 3.1] },
    { symbol: "VGT", rs20: 2.4, vsIndex: "+2.4%", status: "aligned", sparkline: [1.5, 1.7, 1.9, 2.0, 2.2, 2.4] },
    { symbol: "HDC", rs20: -1.8, vsIndex: "−1.8%", status: "blocked", sparkline: [0.5, 0.2, -0.4, -0.9, -1.4, -1.8] },
  ],
  setupIntelligence: [],
  evidence: [
    { label: "Scanner diagnostics", value: "See latest scan", tone: "success" },
    { label: "Data freshness", value: "Aligned", tone: "success" },
    { label: "Market blockers", value: "Chasing · Not in pullback zone", tone: "warning" },
    { label: "Technical evidence", value: "Favorable", tone: "success" },
    { label: "Rejected reasons", value: "Extended above breakout (18)", tone: "warning" },
  ],
};
