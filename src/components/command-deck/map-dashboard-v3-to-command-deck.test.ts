import { describe, expect, it } from "vitest";
import { buildNoTradePreviewViewModel } from "@/lib/dashboard/build-no-trade-preview-view-model";
import type { RadarNode } from "./types";
import {
  dedupeRadarNodes,
  mapDashboardV3ToCommandDeck,
} from "./map-dashboard-v3-to-command-deck";

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
});

describe("mapDashboardV3ToCommandDeck — relative strength", () => {
  it("maps RS rows without synthetic trace sparklines", () => {
    const vm = buildNoTradePreviewViewModel();
    const deck = mapDashboardV3ToCommandDeck(vm);
    for (const row of deck.relativeStrength) {
      expect(row).not.toHaveProperty("sparkline");
    }
  });
});
