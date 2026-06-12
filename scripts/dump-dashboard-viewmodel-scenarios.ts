/**
 * Dump rendered dashboard ViewModel text for product spec verification.
 * Run: npx tsx scripts/dump-dashboard-viewmodel-scenarios.ts
 */
import { buildMarketFreshnessDto } from "../src/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "../src/lib/dashboard/decision-cockpit-dto";
import { mapDashboardV3ViewModel } from "../src/lib/dashboard/map-dashboard-v3-view-model";
import type { MarketContextUiDto } from "../src/lib/market/market-context-ui-dto";

const alignedFreshness = buildMarketFreshnessDto({
  snapshot: {
    benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestScanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
  },
});

const noTradeScanNotes: DecisionCockpitInput["scanNotes"] = {
  topRejectionCategories: {
    pullback_zone_interaction: 42,
    extension_cap: 18,
  },
  rejectionSymbolsByCategory: {
    pullback_zone_interaction: ["HPG", "FPT", "VNM"],
    extension_cap: ["SSI", "VCB"],
  },
  closestToValidSymbols: [
    {
      symbol: "HPG",
      partialPipelineScore: 0.82,
      stageRank: 58,
      reasonLineCount: 2,
      terminalCategory: "pullback_zone_interaction",
      terminalReasonPreview: "Current bar does not interact with the pullback box.",
      rankScore: 71.2,
      close: 28.5,
      breakoutLevel: 27.1,
      pullbackZoneLow: 27.8,
      pullbackZoneHigh: 28.2,
      stopLevel: 26.9,
    },
  ],
  recommendation: {
    likelyBottleneck: "pullback_zone",
    summary: "Largest bucket pullback_zone_interaction",
    note: "Use closest rows.",
  },
};

function baseInput(overrides: Partial<DecisionCockpitInput> = {}): DecisionCockpitInput {
  return {
    latestScan: {
      id: "cmpku2jyq000004l42cv873wq",
      runAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
      gate1Level: "PASS",
      candidateCountA: 0,
      candidateCountB: 0,
      candidateCountSurfaced: 0,
      universeScannedCount: 412,
    },
    scanNotes: noTradeScanNotes,
    liveRegime: {
      level: "WARNING",
      symbol: "VNINDEX",
      latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1245.5 },
    },
    freshness: alignedFreshness,
    surfacedCandidates: [],
    watchlist: [],
    openExposureVnd: 0,
    accountEquityVnd: null,
    portfolioRiskConfigured: false,
    now: new Date(Date.UTC(2026, 4, 25, 14, 0, 0)),
    ...overrides,
  };
}

function mapInput(input: DecisionCockpitInput, openPositionCount = 0, topSetups: DecisionCockpitInput["surfacedCandidates"] = []) {
  const dto = buildDecisionCockpitDto(input);
  return mapDashboardV3ViewModel({
    cockpitDto: dto,
    freshness: input.freshness,
    regime: {
      ...input.liveRegime,
      storedBarsCount: 60,
      evaluatedBarsCount: 60,
      checkedAt: input.now ?? new Date(),
      reasons: [],
      trend: "bullish",
      momentum: "up",
    },
    latestScan: input.latestScan
      ? ({
          id: input.latestScan.id,
          runAt: input.latestScan.runAt,
          gate1Level: input.latestScan.gate1Level,
          candidateCountA: input.latestScan.candidateCountA,
          candidateCountB: input.latestScan.candidateCountB,
          candidateCountSurfaced: input.latestScan.candidateCountSurfaced,
          universeScannedCount: input.latestScan.universeScannedCount,
          notes: null,
          candidates: [],
        } as Parameters<typeof mapDashboardV3ViewModel>[0]["latestScan"])
      : null,
    topSetups,
    trades: [],
    watchItemCount: 2,
    openPositionCount,
    marketContext: input.marketContext ?? null,
  });
}

function foreignContext(net1d: number): MarketContextUiDto {
  return {
    sessionDate: "2026-05-25",
    available: true,
    market: {
      foreignNetValue1d: net1d,
      foreignNetValue5d: null,
      foreignNetValue10d: null,
      foreignSymbolsOk: 159,
      foreignSymbolsTotal: 206,
      foreignCoveragePct: 159 / 206,
      gate1Level: "PASS",
      vnindexVolRatioMa20: 1.1,
    },
    bySymbol: {},
  };
}

const BANNED = [/extension_cap/i, /\bGate 2\b/i, /rankScore/i, /SetupCandidate/i];

function checkBanned(obj: unknown, path = ""): string[] {
  const hits: string[] = [];
  const text = JSON.stringify(obj);
  for (const re of BANNED) {
    if (re.test(text)) hits.push(`${re.source} found in ${path || "output"}`);
  }
  return hits;
}

function printTradeGateRows(label: string, vm: ReturnType<typeof mapInput>) {
  console.log(`\n=== Trade Gate: ${label} ===`);
  console.log(`Subtitle: ${vm.risk.tradeGate.subtitle}`);
  for (const row of vm.risk.tradeGate.rows) {
    console.log(
      `  | ${row.rule.slice(0, 48).padEnd(48)} | ${row.statusLabel.padEnd(12)} | ${row.severity.padEnd(4)} | ${row.action} |`
    );
  }
}

function printHeaderCta(label: string, vm: ReturnType<typeof mapInput>) {
  const c = vm.headerCta;
  console.log(`\n=== Header CTA: ${label} ===`);
  console.log(`Lead: ${c.lead}`);
  console.log(`Primary: [${c.primaryLabel}] → ${c.primaryHref}`);
  console.log(
    `Secondary: ${c.secondaryLabel ? `[${c.secondaryLabel}] → ${c.secondaryHref}` : "(hidden)"}`
  );
  console.log(`Tertiary: ${c.tertiaryLabel ? `[${c.tertiaryLabel}] → ${c.tertiaryHref}` : "(hidden)"}`);
}

function printDashboardText(label: string, vm: ReturnType<typeof mapInput>) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`DASHBOARD TEXT — ${label}`);
  console.log("=".repeat(60));
  console.log(`\n[Page header lead]\n${vm.headerCta.lead}`);
  console.log(`\n[Market Pulse]`);
  console.log(`  Session: ${vm.marketPulse.session}`);
  console.log(`  VNINDEX: ${vm.marketPulse.vnindex ?? "—"}`);
  console.log(`  Freshness: ${vm.marketPulse.freshness}`);
  console.log(`  Regime: ${vm.marketPulse.regime}`);
  if (vm.marketPulse.gate1MismatchNote) console.log(`  Mismatch: ${vm.marketPulse.gate1MismatchNote}`);
  console.log(`  Breadth: ${vm.marketPulse.breadth ?? "—"}`);
  console.log(`  Volatility: ${vm.marketPulse.volatility ?? "—"}`);
  console.log(`  Watch State: ${vm.marketPulse.watchState}`);
  console.log(`\n[Decision Core]`);
  console.log(`  Stance: ${vm.decision.stanceLabel}`);
  console.log(`  Primary reason: ${vm.decision.primaryReason}`);
  console.log(`  Main risk: ${vm.decision.mainRisk ?? "—"}`);
  console.log(`  Capital: ${vm.decision.capitalProtection ?? "—"}`);
  console.log(`  Next action: ${vm.decision.nextAction ?? "—"}`);
  console.log(`\n[Setup Intelligence]`);
  console.log(`  Empty: ${vm.setupIntelligence.emptyMessage || "(populated)"}`);
  console.log(`\n[RS Watchlist banner]\n  ${vm.rsWatchlist.contextNote}`);
  console.log(`\n[Evidence — ${vm.evidence.length} items, defaultOpen=${vm.evidenceDefaultOpen}]`);
  for (const e of vm.evidence) {
    console.log(`  • ${e.label}: ${e.value} [${e.state}]`);
  }
}

// 1. NO TRADE production-like
const noTradeVm = mapInput(baseInput(), 0);
printDashboardText("Production-like NO TRADE (0 surfaced, HPG near-miss)", noTradeVm);

// 2. Trade Gate rows
printTradeGateRows("NO TRADE", noTradeVm);

const watchVm = mapInput(
  baseInput({
    latestScan: {
      ...baseInput().latestScan!,
      gate1Level: "WARNING",
      candidateCountA: 1,
      candidateCountB: 2,
      candidateCountSurfaced: 1,
    },
    scanNotes: {
      ...noTradeScanNotes!,
      decision: { level: "PROBE", allocation: "10-15%", explanation: "Cautious regime." },
    },
    liveRegime: { level: "WARNING", symbol: "VNINDEX", latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1245.5 } },
  })
);
printTradeGateRows("WATCH (PROBE)", watchVm);

const tradeVm = mapInput(
  baseInput({
    latestScan: {
      ...baseInput().latestScan!,
      candidateCountA: 2,
      candidateCountB: 1,
      candidateCountSurfaced: 3,
    },
    scanNotes: {
      ...noTradeScanNotes!,
      decision: { level: "NORMAL", allocation: "50-70%", explanation: "Valid setups available." },
      closestToValidSymbols: [],
    },
    liveRegime: { level: "PASS", symbol: "VNINDEX", latestBar: { date: new Date(Date.UTC(2026, 4, 25)), close: 1286.42 } },
    surfacedCandidates: [
      {
        id: "cand-fpt",
        symbolKey: "FPT",
        quality: "A",
        lifecycleSortLabel: "READY",
        healthLevel: "HEALTHY",
        healthScore: 88,
        healthScoreLabel: "Strong",
        healthFlags: [],
        healthSummary: null,
        reasons: ["Pullback hold"],
        rankSummary: null,
        close: 128,
        pullbackZoneLow: 127,
        pullbackZoneHigh: 129,
        stopLevel: 124,
        rankScore: 90,
      },
    ],
    accountEquityVnd: 2_000_000_000,
  }),
  0,
  [
    {
      id: "cand-fpt",
      symbolKey: "FPT",
      quality: "A",
      lifecycleSortLabel: "READY",
      healthLevel: "HEALTHY",
      healthScore: 88,
      healthScoreLabel: "Strong",
      healthFlags: [],
      healthSummary: null,
      reasons: ["Pullback hold"],
      close: 128,
      pullbackZoneLow: 127,
      pullbackZoneHigh: 129,
      stopLevel: 124,
      rankScore: 90,
    },
  ]
);
printTradeGateRows("TRADE MODE", tradeVm);

// 3. Header CTAs
printHeaderCta("NO TRADE + openTrades > 0", mapInput(baseInput(), 2));
printHeaderCta("NO TRADE + openTrades = 0", mapInput(baseInput(), 0));
printHeaderCta("WATCH", watchVm);
printHeaderCta("TRADE MODE", tradeVm);

// 4. Foreign evidence
for (const net of [-441_000_000_000, -50_000_000_000]) {
  const vm = mapInput(baseInput({ marketContext: foreignContext(net) }));
  console.log(`\n=== Evidence — Foreign 1D = ${net / 1e9}B VND ===`);
  for (const e of vm.evidence.filter((x) => x.label.startsWith("Foreign") || x.label === "Scanner diagnostics")) {
    console.log(`  ${e.label}: ${e.value} [${e.state}]`);
  }
  const f1 = vm.evidence.find((e) => e.label === "Foreign 1D");
  if (f1) console.log(`  → Foreign 1D state: ${f1.state}`);
}

// 5. Banned terms
console.log("\n=== Banned term scan ===");
const allVms = [noTradeVm, watchVm, tradeVm];
const bannedHits: string[] = [];
for (const [i, vm] of allVms.entries()) {
  bannedHits.push(...checkBanned(vm, `scenario-${i}`));
}
console.log(bannedHits.length === 0 ? "PASS — no banned terms in ViewModel JSON" : bannedHits.join("\n"));
