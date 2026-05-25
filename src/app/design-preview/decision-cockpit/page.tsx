"use client";

/**
 * Non-production mockup — Decision Cockpit vNext.
 * Uses real field names / enums from production loaders; values are illustrative.
 * Spec: docs/design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md
 */

import { useState } from "react";
import Link from "next/link";

type ScenarioId = "no_trade_prod" | "trade_day";

const SCENARIOS: Record<
  ScenarioId,
  {
    label: string;
    decision: { level: "NO_TRADE" | "PROBE" | "TRADE"; allocation: string; explanation: string };
    gate1: string;
    vnindex: string;
    countA: number;
    countB: number;
    surfaced: number;
    scanId: string;
    scanAt: string;
    nearMiss: Array<{ symbol: string; category: string; waitFor: string }>;
    candidates: Array<{
      symbol: string;
      quality: "A" | "B";
      ladder: string;
      health: string;
      action: string;
    }>;
    blockers: Array<{ severity: string; title: string; count: number; samples: string }>;
    tomorrow: { watch: string[]; trigger: string; avoid: string; posture: string };
  }
> = {
  no_trade_prod: {
    label: "Production-like — NO TRADE, 0 surfaced",
    decision: {
      level: "NO_TRADE",
      allocation: "0%",
      explanation: "Market is supportive, but no valid setup is available.",
    },
    gate1: "PASS",
    vnindex: "1,245.50 k₫ · 2026-05-25",
    countA: 0,
    countB: 0,
    surfaced: 0,
    scanId: "cmpku2jyq000004l42cv873wq",
    scanAt: "2026-05-25 13:45 UTC",
    nearMiss: [
      {
        symbol: "HPG",
        category: "pullback_zone_interaction",
        waitFor: "A dip or reclaim into the pullback zone.",
      },
      {
        symbol: "FPT",
        category: "extension_cap",
        waitFor: "Pullback toward breakout anchor before entry.",
      },
      {
        symbol: "MWG",
        category: "volume_ratio",
        waitFor: "Participation vs 20-day median to improve.",
      },
    ],
    candidates: [],
    blockers: [
      {
        severity: "Wait",
        title: "Not in pullback entry zone",
        count: 42,
        samples: "HPG, FPT, VNM +39",
      },
      {
        severity: "Avoid",
        title: "Chasing — extended above breakout",
        count: 18,
        samples: "SSI, VCB, TCB +15",
      },
    ],
    tomorrow: {
      watch: ["HPG", "FPT", "MWG"],
      trigger: "HPG: close into pullback box after Gate 1 stays PASS.",
      avoid: "No new swing risk — 0% book cap. Do not chase extended names.",
      posture: "NO TRADE · Capital preservation · 0% allocation",
    },
  },
  trade_day: {
    label: "Illustrative — TRADE with Tier A/B",
    decision: {
      level: "TRADE",
      allocation: "50-70%",
      explanation: "Market is supportive and valid setups are available.",
    },
    gate1: "PASS",
    vnindex: "1,245.50 k₫ · 2026-05-25",
    countA: 2,
    countB: 1,
    surfaced: 3,
    scanId: "cmpku2jyq000004l42cv873wq",
    scanAt: "2026-05-25 13:45 UTC",
    nearMiss: [],
    candidates: [
      {
        symbol: "HPG",
        quality: "A",
        ladder: "Tier A",
        health: "HEALTHY · Strong (82)",
        action: "Log trade → /trades/new?setupCandidateId=…",
      },
      {
        symbol: "FPT",
        quality: "A",
        ladder: "Watch",
        health: "WARNING · Decent (68)",
        action: "Wait for zone — /setups",
      },
      {
        symbol: "MWG",
        quality: "B",
        ladder: "Tier B",
        health: "HEALTHY · Decent (71)",
        action: "Reduced size — /trades/new?setupCandidateId=…",
      },
    ],
    blockers: [
      {
        severity: "Wait",
        title: "Not in pullback entry zone",
        count: 12,
        samples: "VNM, SSI +10",
      },
    ],
    tomorrow: {
      watch: ["HPG", "FPT"],
      trigger: "FPT: reclaim pullback zone 45.2–46.1 k₫ on rising volume.",
      avoid: "Oversize vs 50–70% book cap; no chase on extended momentum names.",
      posture: "TRADE · Normal risk · 50–70% max book",
    },
  },
};

function verdictModifier(level: "NO_TRADE" | "PROBE" | "TRADE"): string {
  if (level === "NO_TRADE") return "dash-decision-hero--no-trade";
  if (level === "PROBE") return "dash-decision-hero--probe";
  return "dash-decision-hero--normal";
}

function Provenance({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded px-1 py-0.5 text-[9px] font-mono uppercase tracking-wide text-[#71717a] bg-[#18181c] border border-[#27272a]">
      {children}
    </span>
  );
}

export default function DecisionCockpitPreviewPage() {
  const [scenario, setScenario] = useState<ScenarioId>("no_trade_prod");
  const s = SCENARIOS[scenario];

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border-b border-[#1a1a1e] pb-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#6366f1]">
            Design preview — not production
          </p>
          <div className="flex flex-wrap justify-between gap-4 items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Decision Cockpit (proposed)</h1>
              <p className="text-xs text-[#52525b] mt-1 max-w-xl">
                Mockup aligned to{" "}
                <code className="text-[#a1a1aa]">docs/design/DASHBOARD_DECISION_COCKPIT_UX_SPEC.md</code>
                . Field names match real loaders; values are illustrative.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/design-preview/trading-os" className="text-xs text-[#818cf8] hover:underline">
                ← Trading OS v2 mockup
              </Link>
              <Link href="/dashboard" className="text-xs text-[#52525b] hover:underline">
                Production dashboard →
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setScenario(id)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-all ${
                  scenario === id
                    ? "bg-[#6366f1] border-[#6366f1] text-white"
                    : "bg-[#121215] border-[#27272a] text-[#a1a1aa] hover:border-[#3f3f46]"
                }`}
              >
                {SCENARIOS[id].label}
              </button>
            ))}
          </div>
        </header>

        {/* A — Trust strip */}
        <div className="dash-market-status dash-market-status--ok rounded-lg">
          <div className="dash-market-status__lead">
            <span className="dash-market-status__dot dash-market-status__dot--ok" aria-hidden />
            <span className="dash-market-status__label">Market data aligned</span>
            <span className="dash-market-status__value dash-market-status__value--muted">
              VNINDEX {s.vnindex}
            </span>
            <Provenance>real + derived</Provenance>
          </div>
          <div className="dash-market-status__chips">
            <span className="dash-chip">
              Gate 1 {s.gate1} <Provenance>real</Provenance>
            </span>
            <span className="dash-chip">
              Scan {s.scanAt} <Provenance>real</Provenance>
            </span>
            <span className="dash-chip font-mono text-[10px]">
              {s.scanId.slice(0, 12)}…
            </span>
          </div>
        </div>

        {/* B — Verdict */}
        <section
          className={`dash-decision-hero dash-surface-2 rounded-lg ${verdictModifier(s.decision.level)}`}
        >
          <p className="dash-eyebrow">
            Today&apos;s verdict <Provenance>notes.decision | computeDailyTradingDecision</Provenance>
          </p>
          <h2 className="dash-decision-hero__title text-2xl">{s.decision.level.replace("_", " ")}</h2>
          <p className="dash-decision-hero__explanation text-sm">{s.decision.explanation}</p>
          <p className="text-xs text-[#a1a1aa] mt-2">
            Confidence: <strong className="text-[#fafafa]">Medium</strong>{" "}
            <Provenance>derived proxy — gap DC-4</Provenance>
          </p>
          <dl className="dash-decision-hero__meta mt-3">
            <div>
              <dt>Max book</dt>
              <dd className="tabular-nums">{s.decision.allocation}</dd>
            </div>
            <div>
              <dt>Surfaced</dt>
              <dd className="tabular-nums">{s.surfaced}</dd>
            </div>
          </dl>
        </section>

        {/* C — Evidence stack */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Gate 1", value: s.gate1, tag: "real" },
            { label: "Tier A", value: String(s.countA), tag: "real" },
            { label: "Tier B", value: String(s.countB), tag: "real" },
            { label: "Surfaced", value: String(s.surfaced), tag: "real" },
            { label: "Aligned", value: "Yes", tag: "derived" },
          ].map((chip) => (
            <div
              key={chip.label}
              className="bg-[#121215] border border-[#1a1a1e] rounded-md px-3 py-2 text-xs"
            >
              <span className="text-[#71717a] uppercase text-[10px] font-semibold">{chip.label}</span>
              <span className="ml-2 font-mono font-semibold">{chip.value}</span>
              <Provenance>{chip.tag}</Provenance>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* D — Opportunity board */}
          <section className="lg:col-span-8 dash-panel dash-surface-1 rounded-lg p-5 space-y-4">
            <header>
              <h2 className="dash-section-title">Opportunity board</h2>
              <p className="dash-panel__subtitle text-xs text-[#71717a]">
                {s.candidates.length > 0
                  ? "Surfaced Tier A/B — prepareSurfacedCandidatesHealthView"
                  : "Zero surfaced — closestToValidSymbols from scan notes"}
              </p>
            </header>

            {s.candidates.length > 0 ? (
              <ul className="space-y-3">
                {s.candidates.map((c) => (
                  <li
                    key={c.symbol}
                    className="bg-[#18181c] border border-[#27272a] rounded-lg p-4 flex flex-wrap justify-between gap-3"
                  >
                    <div>
                      <span className="font-mono font-bold text-base">{c.symbol}</span>
                      <span className="ml-2 text-xs text-[#10b981]">{c.ladder}</span>
                      <span className="ml-2 text-xs text-[#71717a]">Tier {c.quality}</span>
                      <p className="text-xs text-[#a1a1aa] mt-1">{c.health}</p>
                    </div>
                    <span className="text-[10px] text-[#818cf8]">{c.action}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2">
                {s.nearMiss.map((row) => (
                  <li
                    key={row.symbol}
                    className="bg-[#18181c] rounded-lg px-3 py-2 text-xs border border-[#27272a]"
                  >
                    <span className="font-mono font-semibold">{row.symbol}</span>
                    <span className="text-[#71717a] ml-2">{row.category}</span>
                    <p className="text-[#a1a1aa] mt-1">Trigger: {row.waitFor}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* F — Risk guardrail */}
          <section className="lg:col-span-4 dash-exposure dash-surface-1 rounded-lg p-5">
            <h2 className="dash-section-title">Risk guardrail</h2>
            <ul className="mt-3 space-y-2 text-xs text-[#a1a1aa]">
              <li>
                Max book: <strong className="text-[#fafafa]">{s.decision.allocation}</strong>
              </li>
              <li>
                Per-trade: <strong className="text-[#fafafa]">10–20%</strong>{" "}
                <Provenance>static</Provenance>
              </li>
              <li>No-chase when extended / extension_cap</li>
              <li>Stop from candidate.stopLevel — not portfolio R</li>
            </ul>
          </section>
        </div>

        {/* E — Ladder */}
        <section className="dash-panel dash-surface-1 rounded-lg p-5">
          <h2 className="dash-section-title">Setup quality ladder</h2>
          <p className="text-xs text-[#71717a] mb-3">
            Derived map: quality + lifecycleSortLabel + healthLevel + closest status (spec §7)
          </p>
          <table className="table text-xs w-full">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Ladder</th>
                <th>quality</th>
                <th>healthLevel</th>
              </tr>
            </thead>
            <tbody>
              {(s.candidates.length > 0 ? s.candidates : s.nearMiss.map((n) => ({
                symbol: n.symbol,
                ladder: "Watch",
                quality: "—",
                health: n.category,
              }))).map((row) => (
                <tr key={row.symbol}>
                  <td className="font-mono">{row.symbol}</td>
                  <td>{"ladder" in row ? row.ladder : "Watch"}</td>
                  <td>{"quality" in row ? row.quality : "—"}</td>
                  <td>{"health" in row ? row.health : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* G — Tomorrow */}
        <section className="dash-panel dash-surface-1 rounded-lg p-5 border-l-4 border-l-[#6366f1]">
          <h2 className="dash-section-title">Tomorrow&apos;s plan</h2>
          <Provenance>derived — gap DC-6</Provenance>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase text-[#71717a] font-semibold">Watch</dt>
              <dd>{s.tomorrow.watch.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-[#71717a] font-semibold">Trigger</dt>
              <dd className="text-[#a1a1aa]">{s.tomorrow.trigger}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-[#71717a] font-semibold">Avoid</dt>
              <dd className="text-[#a1a1aa]">{s.tomorrow.avoid}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-[#71717a] font-semibold">Posture</dt>
              <dd className="font-medium">{s.tomorrow.posture}</dd>
            </div>
          </dl>
        </section>

        {/* Actionable blockers (diagnostics rewrite) */}
        <section className="dash-panel dash-surface-1 rounded-lg p-5">
          <h2 className="dash-section-title">Actionable blockers (max 3)</h2>
          <p className="text-xs text-[#71717a]">
            Replaces flat diagnostics — topRejectionCategories + rejectionSymbolsByCategory
          </p>
          <ul className="mt-3 space-y-2">
            {s.blockers.map((b) => (
              <li
                key={b.title}
                className="dash-diagnostics-stack__item bg-[#18181c] rounded-lg p-3 text-xs"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    [{b.severity}] {b.title}
                  </span>
                  <span className="tabular-nums text-[#71717a]">{b.count}</span>
                </div>
                <p className="text-[#52525b] mt-1">Sample: {b.samples}</p>
              </li>
            ))}
          </ul>
          <Link href="/setups" className="inline-block mt-3 text-xs text-[#818cf8]">
            Full pipeline diagnostics → /setups
          </Link>
        </section>
      </div>
    </div>
  );
}
