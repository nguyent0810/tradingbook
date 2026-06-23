import { describe, expect, it } from "vitest";
import { buildNoTradePreviewViewModel } from "@/lib/dashboard/build-no-trade-preview-view-model";
import { mapRsWatchlistEntryToV3Card } from "@/lib/dashboard/v3-user-copy";
import type { RadarNode } from "./types";
import {
  dedupeRadarNodes,
  mapDashboardV3ToCommandDeck,
} from "./map-dashboard-v3-to-command-deck";

const RS_ROW_FIXTURE = {
  symbol: "VND",
  sessionDate: "2026-05-28",
  rs20SpreadPct: 11.6,
  rs50SpreadPct: -0.2,
  terminalCode: "pullback_zone_interaction",
  failedGate2Because: "Failed Gate 2 because: Not in pullback entry zone (pullback_zone_interaction)",
  topRejectionReason: "Trend OK",
  stageRank: 58,
  distanceToPullbackZoneFrac: 0.02,
  actionHint: "",
  disclaimerLines: [],
  rsDiagnostic: null,
};

describe("dedupeRadarNodes", () => {
  it("keeps one node per symbol with strictest classification", () => {
    const nodes: RadarNode[] = [
      {
        symbol: "VJC",
        readiness: 58,
        risk: 42,
        classification: "watch",
        tier: "Near miss",
        reason: "Pullback zone interaction",
        sparkline: [40, 45, 50, 52, 58],
      },
      {
        symbol: "VJC",
        readiness: 22,
        risk: 88,
        classification: "avoid",
        tier: "Rejected",
        reason: "Extension cap",
        sparkline: [48, 44, 38, 32, 28],
      },
    ];

    const merged = dedupeRadarNodes(nodes);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.symbol).toBe("VJC");
    expect(merged[0]?.classification).toBe("avoid");
    expect(merged[0]?.tier).toBe("Rejected");
  });

  it("downgrades actionable to watch when a watch duplicate exists only if watch is stricter", () => {
    const nodes: RadarNode[] = [
      {
        symbol: "FPT",
        readiness: 72,
        risk: 30,
        classification: "actionable",
        tier: "Qualified",
        reason: "Ready",
        sparkline: [60, 65, 68, 70, 72],
      },
      {
        symbol: "FPT",
        readiness: 55,
        risk: 45,
        classification: "watch",
        tier: "Near miss",
        reason: "Wait for zone",
        sparkline: [40, 45, 50, 52, 55],
      },
    ];

    const merged = dedupeRadarNodes(nodes);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.classification).toBe("watch");
  });
});

describe("mapDashboardV3ToCommandDeck — opportunity radar", () => {
  it("dedupes symbols that appear in map dots and avoid placeholders", () => {
    const vm = buildNoTradePreviewViewModel();
    vm.radar.mapDots = [
      {
        symbol: "VJC",
        tier: "Near miss",
        readiness: 58,
        risk: 42,
        status: "near-miss",
        reason: "Pullback zone interaction",
      },
    ];
    vm.radar.avoidPlaceholders = [{ symbol: "VJC", caption: "Extension cap" }];

    const deck = mapDashboardV3ToCommandDeck(vm);
    const vjc = deck.radar.filter((n) => n.symbol === "VJC");
    expect(vjc).toHaveLength(1);
    expect(vjc[0]?.classification).toBe("avoid");
  });

  it("does not surface actionable dots outside TRADE mode", () => {
    const vm = buildNoTradePreviewViewModel();
    vm.decision.mode = "PROTECT CAPITAL";
    vm.radar.mapDots = [
      {
        symbol: "FPT",
        tier: "Qualified",
        readiness: 78,
        risk: 28,
        status: "qualified",
        reason: "Healthy pullback",
      },
    ];
    vm.radar.avoidPlaceholders = [];

    const deck = mapDashboardV3ToCommandDeck(vm);
    expect(deck.radar.find((n) => n.symbol === "FPT")?.classification).toBe("watch");
  });

  it("uses workbench rows for radar when relative strength is populated", () => {
    const vm = buildNoTradePreviewViewModel();
    vm.rsWatchlist.cards = [mapRsWatchlistEntryToV3Card(RS_ROW_FIXTURE)];

    const deck = mapDashboardV3ToCommandDeck(vm);
    expect(deck.relativeStrength.length).toBeGreaterThan(0);
    const workbenchSymbols = deck.relativeStrength.map((r) => r.symbol);
    expect(deck.radar.map((n) => n.symbol)).toEqual(workbenchSymbols);
    for (const node of deck.radar) {
      expect(node.reason).not.toContain("Blocked sample");
    }
  });
});

describe("mapDashboardV3ToCommandDeck — relative strength", () => {
  it("maps RS rows without synthetic trace sparklines", () => {
    const vm = buildNoTradePreviewViewModel();
    const deck = mapDashboardV3ToCommandDeck(vm);
    for (const row of deck.relativeStrength) {
      expect(row).not.toHaveProperty("sparkline");
    }
  });

  it("maps RS50, setup state, and reason from V3 cards", () => {
    const vm = buildNoTradePreviewViewModel();
    vm.rsWatchlist.cards = [mapRsWatchlistEntryToV3Card(RS_ROW_FIXTURE)];

    const deck = mapDashboardV3ToCommandDeck(vm);
    const row = deck.relativeStrength[0]!;
    expect(row.symbol).toBe("VND");
    expect(row.rs20).toBe(11.6);
    expect(row.rs50).toBe(-0.2);
    expect(row.setupState).toBe("Blocked: zone");
    expect(row.reason).toBe("Not in pullback entry zone");
    expect(row.rsStrength).toBe("Positive RS");
    expect(row.status).toBe("blocked");
    expect(row.reason).not.toMatch(/^Blocked$/);
  });
});

describe("mapDashboardV3ToCommandDeck — session evidence", () => {
  it("passes Foreign 1D and Foreign cov. through Session Evidence when present in view model", () => {
    const vm = buildNoTradePreviewViewModel();
    vm.evidence = [
      ...vm.evidence,
      { label: "Foreign 1D", value: "−458.37B ₫ net", state: "danger", provenance: "real" },
      { label: "Foreign cov.", value: "159/206 OK (77%)", state: "ok", provenance: "derived" },
    ];

    const deck = mapDashboardV3ToCommandDeck(vm);
    const labels = deck.evidence.map((e) => e.label);
    expect(labels).toContain("Foreign 1D");
    expect(labels).toContain("Foreign cov.");

    const foreign1d = deck.evidence.find((e) => e.label === "Foreign 1D");
    const foreignCov = deck.evidence.find((e) => e.label === "Foreign cov.");
    expect(foreign1d?.value).toMatch(/₫ net$/);
    expect(foreignCov?.value).toMatch(/OK \(\d+%\)$/);
    expect(foreign1d?.tone).toBe("danger");
    expect(foreignCov?.tone).toBe("success");
  });

  it("includes Foreign 5D/10D in evidence only when view model chips exist", () => {
    const vm = buildNoTradePreviewViewModel();
    vm.evidence = [
      ...vm.evidence,
      { label: "Foreign 1D", value: "+1.00B ₫ net", state: "ok", provenance: "real" },
      { label: "Foreign cov.", value: "184/229 OK (80%)", state: "ok", provenance: "derived" },
      { label: "Foreign 5D", value: "−7.55T ₫ net", state: "danger", provenance: "derived" },
      { label: "Foreign 10D", value: "−5.20T ₫ net", state: "danger", provenance: "derived" },
    ];

    const deck = mapDashboardV3ToCommandDeck(vm);
    expect(deck.evidence.some((e) => e.label === "Foreign 5D")).toBe(true);
    expect(deck.evidence.some((e) => e.label === "Foreign 10D")).toBe(true);

    const vmNoRollups = buildNoTradePreviewViewModel();
    vmNoRollups.evidence = [
      ...vmNoRollups.evidence,
      { label: "Foreign 1D", value: "+1.00B ₫ net", state: "ok", provenance: "real" },
      { label: "Foreign cov.", value: "184/229 OK (80%)", state: "ok", provenance: "derived" },
    ];
    const deckNoRollups = mapDashboardV3ToCommandDeck(vmNoRollups);
    expect(deckNoRollups.evidence.some((e) => e.label === "Foreign 5D")).toBe(false);
    expect(deckNoRollups.evidence.some((e) => e.label === "Foreign 10D")).toBe(false);
  });

  it("mirrors foreign chips into command bar stats", () => {
    const vm = buildNoTradePreviewViewModel();
    vm.evidence = [
      ...vm.evidence,
      { label: "Foreign 1D", value: "+7.59B ₫ net", state: "ok", provenance: "real" },
      { label: "Foreign cov.", value: "184/229 OK (80%)", state: "ok", provenance: "derived" },
    ];

    const deck = mapDashboardV3ToCommandDeck(vm);
    expect(deck.commandBar.stats.map((s) => s.label)).toEqual(["Foreign 1D", "Foreign cov."]);
  });
});
