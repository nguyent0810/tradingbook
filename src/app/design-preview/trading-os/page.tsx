"use client";

import { useState } from "react";
import { AreaChart, Area, Tooltip } from "recharts";
import { ChartFrame, ChartPlot } from "@/components/command-deck";
import { motion, type Variants } from "framer-motion";

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 90,
      damping: 15,
    },
  },
} satisfies Variants;

const mockPerformanceData = [
  { date: "May 1", cumulativePnl: -2000000 },
  { date: "May 5", cumulativePnl: -1500000 },
  { date: "May 8", cumulativePnl: 1000000 },
  { date: "May 12", cumulativePnl: 800000 },
  { date: "May 15", cumulativePnl: 3500000 },
  { date: "May 18", cumulativePnl: 12000000 },
  { date: "May 22", cumulativePnl: 25000000 },
  { date: "May 25", cumulativePnl: 45120000 },
];


export default function DesignPreviewPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "setups" | "trades">("dashboard");

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] font-sans antialiased p-6 sm:p-10">
      
      {/* PREVIEW BANNER */}
      <div className="mb-6 bg-[#121215] border border-[#1f1f23] rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <span className="text-xs font-semibold text-[#6366f1] uppercase tracking-wider">Trading OS v2 Design Preview</span>
          <h2 className="text-sm font-medium text-[#a1a1aa] mt-1">This page renders static mockup components using mock data only. Production routes are unchanged.</h2>
        </div>
        <div className="flex gap-2 bg-[#09090b] p-1 rounded-lg border border-[#1f1f23]">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "dashboard" ? "bg-[#18181c] text-[#fafafa] shadow" : "text-[#71717a] hover:text-[#fafafa]"}`}
          >
            Dashboard Cockpit
          </button>
          <button
            onClick={() => setActiveTab("setups")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "setups" ? "bg-[#18181c] text-[#fafafa] shadow" : "text-[#71717a] hover:text-[#fafafa]"}`}
          >
            Setups Pipeline
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "trades" ? "bg-[#18181c] text-[#fafafa] shadow" : "text-[#71717a] hover:text-[#fafafa]"}`}
          >
            Trades Ledger
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ======================================================== */}
        {/* 1. DASHBOARD COCKPIT */}
        {/* ======================================================== */}
        {activeTab === "dashboard" && (
          <motion.div
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.08,
                },
              },
            }}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            
            {/* Page Header */}
            <motion.div variants={itemVariants} className="flex justify-between items-start border-b border-[#1a1a1e] pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-xs text-[#52525b] mt-1">EOD Decision-First Cockpit &bull; Last synchronized with exchange EOD bars: May 25, 2026</p>
              </div>
              <button className="bg-[#6366f1] hover:bg-[#818cf8] text-white px-4 py-2 rounded-md text-xs font-semibold transition-all">
                + Log Trade
              </button>
            </motion.div>

            {/* MarketStatusBar */}
            <motion.div variants={itemVariants} className="bg-[#121215] border border-[#1a1a1e] px-4 py-3 rounded-lg flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#fafafa] bg-[#18181c] px-1.5 py-1 rounded">VNINDEX</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                  <span className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">Gate 1 Pass</span>
                </div>
                <span className="w-[1px] h-3 bg-[#1f1f23]"></span>
                <span className="text-xs text-[#a1a1aa]">Breadth: <strong className="text-[#fafafa]">71.4%</strong> setups healthy &bull; Trend: <strong className="text-[#10b981]">Bullish</strong></span>
              </div>
              <div className="text-xs text-[#52525b] font-mono">
                Scan Freshness: 10 mins ago
              </div>
            </motion.div>

            {/* Split Grid (5/12 left, 7/12 right) */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (5/12) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* DecisionHero */}
                <div className="bg-[#121215] border border-[#1a1a1e] border-l-4 border-l-[#f59e0b] rounded-lg p-5 flex flex-col gap-2 shadow-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Today&apos;s Action Stance</span>
                    <span className="bg-[rgba(245,158,11,0.12)] text-[#f59e0b] text-[9px] font-bold px-2 py-0.5 rounded font-mono">NEUTRAL</span>
                  </div>
                  <h2 className="text-lg font-bold text-[#fafafa]">
                    NO_TRADE: <span className="text-[#f59e0b]">Capital Preservation</span>
                  </h2>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed">
                    Index consolidation in progress. The EOD daily scanner produced no high-quality setups matching breakout or pullback criteria. Do not initiate new long risk today.
                  </p>
                  <div className="text-xs text-[#71717a] mt-2 flex gap-4 font-mono">
                    <span>Stance Cap: 0%</span>
                    <span>Surfaced: 0 Tier A/B</span>
                  </div>
                </div>

                {/* ExposureSnapshot */}
                <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 flex flex-col gap-3 shadow-lg">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Exposure Snapshot</span>
                      <span className="text-xs font-mono font-semibold text-[#a1a1aa]">0% / 0% Cap (No Active Risk)</span>
                    </div>
                    <div className="h-1.5 bg-[#18181c] rounded-full overflow-hidden mb-2">
                      <div className="w-0 h-full bg-[#6366f1] rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-xs text-[#a1a1aa]">
                      <span>Allocated: <strong>0 ₫</strong></span>
                      <span>Available Capacity: <strong className="text-[#10b981]">0%</strong></span>
                    </div>
                  </div>
                  <div className="border-t border-[#1f1f23] pt-2.5 flex flex-col gap-1 text-xs text-[#71717a]">
                    <div className="flex justify-between">
                      <span>Max per-trade exposure:</span>
                      <span className="text-[#fafafa] font-mono">10-20% of equity</span>
                    </div>
                    <div className="flex justify-between text-[#f59e0b] font-medium">
                      <span>Guidance:</span>
                      <span>No new entries permitted</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column (7/12) */}
              <div className="lg:col-span-7 bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 flex flex-col justify-between h-full shadow-lg min-h-[300px]">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Equity Curve &amp; System Performance</span>
                    <span className="text-xs text-[#71717a] font-mono">Active window: 30 days</span>
                  </div>

                  {/* KPI Row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-[#18181c] p-3 rounded-lg">
                      <span className="text-[9px] text-[#71717a] uppercase block mb-1">Closed Trades</span>
                      <span className="text-base font-bold font-mono">24</span>
                    </div>
                    <div className="bg-[#18181c] p-3 rounded-lg">
                      <span className="text-[9px] text-[#71717a] uppercase block mb-1">Win Rate</span>
                      <span className="text-base font-bold font-mono">58.3%</span>
                    </div>
                    <div className="bg-[#18181c] p-3 rounded-lg">
                      <span className="text-[9px] text-[#71717a] uppercase block mb-1">Cumulative P&amp;L</span>
                      <span className="text-base font-bold font-mono text-[#10b981]">+45.12M ₫</span>
                    </div>
                  </div>

                  {/* Chart Line preview */}
                  <ChartFrame height={100} state="ready" className="chart-frame--inline border-b border-[#1a1a1e] pb-2">
                    <ChartPlot height={100}>
                      <AreaChart data={mockPerformanceData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="previewPerfPnlGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity="0.25" />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          content={(props) => {
                            const { active, payload } = props;
                            if (active && payload && payload.length > 0) {
                              const data = payload[0]?.payload as {
                                date: string;
                                cumulativePnl: number;
                              };
                              if (!data) return null;
                              return (
                                <div className="bg-[#18181c] border border-[#27272a] rounded-lg p-2 shadow-xl text-xs font-sans">
                                  <p className="text-[#71717a] font-mono text-[10px]">{data.date}</p>
                                  <p className="font-semibold mt-0.5 text-[#10b981]">
                                    {data.cumulativePnl >= 0 ? "+" : ""}{(data.cumulativePnl / 1000000).toFixed(2)}M ₫
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativePnl"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#previewPerfPnlGrad)"
                        />
                      </AreaChart>
                    </ChartPlot>
                  </ChartFrame>
                </div>

                <div className="flex justify-between items-center text-xs text-[#52525b] mt-4">
                  <span>Account Equity: VN₫ 150M configured</span>
                  <span className="text-[#6366f1] cursor-pointer hover:underline">View Full Ledger &rarr;</span>
                </div>
              </div>

            </motion.div>

            {/* Run Meta */}
            <motion.div variants={itemVariants} className="bg-[#121215] border border-[#1a1a1e] px-4 py-3 rounded-lg flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Daily Scan Run Info</span>
                <span className="w-1 h-1 bg-[#71717a] rounded-full"></span>
                <span className="text-xs text-[#a1a1aa]">Run Date: <strong className="text-[#fafafa]">2026-05-25 13:45 UTC</strong></span>
              </div>
              <div className="text-xs text-[#a1a1aa] font-mono">
                Surfaced Candidates: <span className="text-[#fafafa] font-bold">4</span> | Near-misses Rejected: <span className="text-[#ef4444] font-bold">12</span>
              </div>
            </motion.div>

            {/* Best Setups with Empty State */}
            <motion.div variants={itemVariants} className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider">Best Setups</h3>
                  <p className="text-[10px] text-[#71717a] mt-0.5">Qualified opportunity shortlist &bull; Core Playbook Tier A/B only</p>
                </div>
                <span className="text-[#6366f1] text-xs cursor-pointer hover:underline" onClick={() => setActiveTab("setups")}>Open setups pipeline &rarr;</span>
              </div>

              {/* Compact Empty State */}
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-[#09090b] rounded-lg border border-dashed border-[#1a1a1e]">
                <div className="w-10 h-10 rounded-full bg-[rgba(245,158,11,0.08)] flex items-center justify-center mb-3 border border-[rgba(245,158,11,0.2)]">
                  <svg className="w-5 h-5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-[#fafafa] mb-1">No Qualified Setups Surfaced Today</h4>
                <p className="text-xs text-[#a1a1aa] max-width: 440px; leading-relaxed mb-3">
                  The daily scan completed successfully but produced zero candidates matching Tier A/B playbook standards. Gate 1 regime is PASS but index consolidations have temporarily dampened breakout velocity.
                </p>
                <div className="flex gap-2">
                  <button className="bg-[#18181c] border border-[#27272a] hover:bg-[#202026] text-[#fafafa] text-xs px-3 py-1.5 rounded transition-all">
                    View Pipeline History
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Watchlist & Diagnostics */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* Watchlist */}
              <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 shadow-lg flex flex-col h-full min-h-[220px]">
                <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider mb-3">Watchlist Queue</h3>
                <div className="flex flex-col items-center justify-center py-6 px-4 text-center bg-[#09090b] rounded-lg border border-dashed border-[#1a1a1e] flex-1">
                  <span className="text-xs font-bold text-[#71717a] uppercase tracking-wider mb-1">Queue Empty</span>
                  <p className="text-xs text-[#52525b] max-w-[240px] leading-relaxed">
                    No watch items are active. Setups will populate here when they pullback toward support.
                  </p>
                </div>
              </div>

              {/* Diagnostics stack */}
              <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 shadow-lg">
                <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider mb-3">Scan Invalidation Diagnostics</h3>
                
                <div className="flex flex-col gap-2">
                  <div className="bg-[#18181c] p-3 rounded-lg flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#fafafa]">Extended from Support (MA20)</span>
                      <span className="bg-[rgba(245,158,11,0.12)] text-[#f59e0b] text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">6 NAMES</span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] leading-relaxed">
                      Price is &gt;5% above the breakout anchor level. Wait for pullback validation. (TCB, ACB, MBB, SSI, HPG, VCB)
                    </p>
                  </div>

                  <div className="bg-[#18181c] p-3 rounded-lg flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[#fafafa]">Fading Volume on Breakout</span>
                      <span className="bg-[rgba(249,115,22,0.12)] text-[#f97316] text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">4 NAMES</span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] leading-relaxed">
                      Breakout occurred on volume below 50-day average. Fails liquidity rules. (DGC, FPT, MWG, KBC)
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>

          </motion.div>
        )}

        {/* ======================================================== */}
        {/* 2. SETUPS SCANNER PIPELINE */}
        {/* ======================================================== */}
        {activeTab === "setups" && (
          <div className="space-y-6">
            
            {/* Page Header */}
            <div className="flex justify-between items-start border-b border-[#1a1a1e] pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Setups Pipeline</h1>
                <p className="text-xs text-[#52525b] mt-1">Real-time EOD scanning, pullback zone verification, and candidate diagnostics.</p>
              </div>
              <div className="flex gap-2">
                <button className="bg-[#18181c] border border-[#27272a] hover:bg-[#202026] text-[#a1a1aa] px-4 py-2 rounded-md text-xs font-semibold transition-all">
                  Scanner Settings
                </button>
                <button className="bg-[#6366f1] hover:bg-[#818cf8] text-white px-4 py-2 rounded-md text-xs font-semibold transition-all">
                  Run Scan Now
                </button>
              </div>
            </div>

            {/* MarketStatusBar */}
            <div className="bg-[#121215] border border-[#1a1a1e] px-4 py-3 rounded-lg flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#fafafa] bg-[#18181c] px-1.5 py-1 rounded">VNINDEX</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                  <span className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">Gate 1 Pass</span>
                </div>
              </div>
              <div className="text-xs text-[#52525b] font-mono">
                Sync: Fresh
              </div>
            </div>

            {/* Pipeline summary strip */}
            <div className="bg-[#121215] p-3 px-4 rounded-lg border border-[#1a1a1e] flex justify-between items-center gap-4 shadow-lg overflow-x-auto">
              <div className="flex gap-4 items-center whitespace-nowrap">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase text-[#71717a] font-bold">Universe Scanned</span>
                  <span className="text-xs font-bold font-mono text-[#fafafa] mt-0.5">350 stocks</span>
                </div>
                <span className="text-[#27272a] text-sm">&rarr;</span>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase text-[#71717a] font-bold">Gate 1 Regime</span>
                  <span className="text-xs font-bold text-[#10b981] mt-0.5">PASS (Bullish)</span>
                </div>
                <span className="text-[#27272a] text-sm">&rarr;</span>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase text-[#71717a] font-bold">Tradability Filter</span>
                  <span className="text-xs font-bold font-mono text-[#fafafa] mt-0.5">16 passed</span>
                </div>
                <span className="text-[#27272a] text-sm">&rarr;</span>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase text-[#71717a] font-bold">Surfaced Setups</span>
                  <span className="text-xs font-bold font-mono text-[#fafafa] mt-0.5">0 candidates</span>
                </div>
              </div>
              <div className="bg-[rgba(99,102,241,0.1)] border border-[rgba(99,102,241,0.2)] px-2.5 py-1 rounded text-[10px] text-[#a5b4fc] font-mono whitespace-nowrap">
                Run Date: May 25, 13:45 UTC
              </div>
            </div>

            {/* Main workspace split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column (8/12) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Surfaced setups */}
                <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 shadow-lg">
                  <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider mb-3">Active Surfaced Candidates (0)</h3>
                  
                  {/* Compact Empty State */}
                  <div className="bg-[#09090b] border border-dashed border-[#1c1c22] p-6 rounded-lg text-center flex flex-col items-center justify-center">
                    <svg className="w-6 h-6 text-[#71717a] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                    </svg>
                    <span className="text-xs font-bold text-[#fafafa]">No Setups Surfaced Today</span>
                    <span className="text-[11px] text-[#a1a1aa] mt-1 max-w-xs">0 candidates passed EOD quality checks. Check the near-miss pipeline below.</span>
                  </div>

                  {/* Sample Active Row */}
                  <div className="mt-5 border-t border-[#1f1f23] pt-4">
                    <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block mb-2">Candidate Present State (Sample Active Row)</span>
                    
                    <div className="bg-[#18181c] border border-[#202026] rounded-lg p-3 flex flex-col gap-2 shadow">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-[#fafafa]">TCB</span>
                          <span className="bg-[rgba(16,185,129,0.12)] text-[#10b981] text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">READY</span>
                          <span className="bg-[rgba(99,102,241,0.12)] text-[#a5b4fc] text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">TIER A</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#a1a1aa]">
                          <span>Score: <strong className="text-[#fafafa]">Strong (88)</strong></span>
                          <button className="bg-[#6366f1] text-white px-2.5 py-1 rounded text-[10px] font-semibold hover:bg-[#818cf8]">
                            Initiate Trade
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-[#a1a1aa] border-t border-[#202026] pt-1.5">
                        <span>Close: <strong className="text-[#fafafa] font-mono">48.20</strong></span>
                        <span>Pullback Zone: <strong className="text-[#fafafa] font-mono">47.50 &ndash; 48.30</strong></span>
                        <span>Stop Anchor: <strong className="text-[#ef4444] font-mono">45.80</strong></span>
                        <span className="text-[#10b981]">Zone Pullback: <strong className="text-[#fafafa]">Healthy</strong></span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Near-Misses Table */}
                <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 shadow-lg">
                  <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider mb-3">Near-Miss Pipeline (4)</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs text-left">
                      <thead>
                        <tr className="border-b border-[#1f1f23] text-[#71717a] text-[10px] uppercase tracking-wider">
                          <th className="py-2 px-2">Symbol</th>
                          <th className="py-2 px-2">Stance</th>
                          <th className="py-2 px-2">Fail Reason</th>
                          <th className="py-2 px-2 text-right">Distance to Zone</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[#1a1a1e]">
                          <td className="py-2.5 px-2 font-mono font-bold text-[#fafafa]">HPG</td>
                          <td className="py-2.5 px-2"><span className="bg-[rgba(245,158,11,0.12)] text-[#f59e0b] text-[9px] px-1.5 py-0.5 rounded font-mono">WATCHING</span></td>
                          <td className="py-2.5 px-2 text-[#a1a1aa]">Pullback volume fading, no breakout hold yet</td>
                          <td className="py-2.5 px-2 text-right font-mono text-[#f59e0b]">+1.4%</td>
                        </tr>
                        <tr className="border-b border-[#1a1a1e]">
                          <td className="py-2.5 px-2 font-mono font-bold text-[#fafafa]">SSI</td>
                          <td className="py-2.5 px-2"><span className="bg-[rgba(245,158,11,0.12)] text-[#f59e0b] text-[9px] px-1.5 py-0.5 rounded font-mono">WATCHING</span></td>
                          <td className="py-2.5 px-2 text-[#a1a1aa]">Entry zone too deep (&gt;8% from top anchor)</td>
                          <td className="py-2.5 px-2 text-right font-mono text-[#f59e0b]">+2.1%</td>
                        </tr>
                        <tr className="border-b border-[#1a1a1e]">
                          <td className="py-2.5 px-2 font-mono font-bold text-[#fafafa]">MBB</td>
                          <td className="py-2.5 px-2"><span className="bg-[rgba(245,158,11,0.12)] text-[#f59e0b] text-[9px] px-1.5 py-0.5 rounded font-mono">WATCHING</span></td>
                          <td className="py-2.5 px-2 text-[#a1a1aa]">Pullback zone below EMA21, setup integrity weak</td>
                          <td className="py-2.5 px-2 text-right font-mono text-[#ef4444]">-0.5%</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-2 font-mono font-bold text-[#fafafa]">ACB</td>
                          <td className="py-2.5 px-2"><span className="bg-[rgba(245,158,11,0.12)] text-[#f59e0b] text-[9px] px-1.5 py-0.5 rounded font-mono">WATCHING</span></td>
                          <td className="py-2.5 px-2 text-[#a1a1aa]">Setup extended from breakout line</td>
                          <td className="py-2.5 px-2 text-right font-mono text-[#ef4444]">+6.2%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Right Column (4/12) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Pipeline funnel */}
                <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 shadow-lg">
                  <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider mb-3">Pipeline Filter Funnel</h3>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-[#18181c] p-2 px-3 rounded flex justify-between items-center text-xs">
                      <span className="text-[#a1a1aa]">1. Total Universe Scanned</span>
                      <span className="font-mono font-bold">350</span>
                    </div>
                    <div className="bg-[#18181c] p-2 px-3 rounded flex justify-between items-center text-xs border-l-2 border-l-[#10b981]">
                      <span className="text-[#a1a1aa]">2. Gate 1 Regime (PASS)</span>
                      <span className="font-mono font-bold text-[#10b981]">350</span>
                    </div>
                    <div className="bg-[#18181c] p-2 px-3 rounded flex justify-between items-center text-xs border-l-2 border-l-[#6366f1]">
                      <span className="text-[#a1a1aa]">3. Liquidity &amp; Trend Align</span>
                      <span className="font-mono font-bold">16</span>
                    </div>
                    <div className="bg-[#18181c] p-2 px-3 rounded flex justify-between items-center text-xs border-l-2 border-l-[#f59e0b]">
                      <span className="text-[#a1a1aa]">4. Pullback Zone Proximity</span>
                      <span className="font-mono font-bold">4</span>
                    </div>
                    <div className="bg-[#18181c] p-2 px-3 rounded flex justify-between items-center text-xs border-l-2 border-l-[#ef4444]">
                      <span className="text-[#a1a1aa]">5. Invalidation Check (Near)</span>
                      <span className="font-mono font-bold text-[#ef4444]">0</span>
                    </div>
                  </div>
                </div>

                {/* Rejection diagnostics */}
                <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-5 shadow-lg">
                  <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider mb-3">Rejection Diagnostics (12)</h3>
                  <div className="flex flex-col gap-2">
                    <div className="bg-[#18181c] p-3 rounded-lg flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#fafafa]">Extended from Support</span>
                        <span className="bg-[rgba(245,158,11,0.12)] text-[#f59e0b] text-[9px] px-1.5 py-0.5 rounded font-mono">6 NAMES</span>
                      </div>
                      <p className="text-[10px] text-[#a1a1aa] leading-relaxed">
                        Price trading &gt;5% above breakout anchor level. Wait for pullback. (TCB, ACB, SSI)
                      </p>
                    </div>

                    <div className="bg-[#18181c] p-3 rounded-lg flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#fafafa]">Fading Breakout Volume</span>
                        <span className="bg-[rgba(249,115,22,0.12)] text-[#f97316] text-[9px] px-1.5 py-0.5 rounded font-mono">4 NAMES</span>
                      </div>
                      <p className="text-[10px] text-[#a1a1aa] leading-relaxed">
                        Breakout volume failed average volume filter. Low liquidity. (DGC, FPT, MWG)
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* 3. TRADES LEDGER */}
        {/* ======================================================== */}
        {activeTab === "trades" && (
          <div className="space-y-6">
            
            {/* Page Header */}
            <div className="flex justify-between items-start border-b border-[#1a1a1e] pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Trades Ledger</h1>
                <p className="text-xs text-[#52525b] mt-1">Audit-grade EOD execution history &bull; <strong className="text-[#fafafa]">26 Trades Logged</strong> (2 Active Positions, 24 Closed)</p>
              </div>
              <button className="bg-[#6366f1] hover:bg-[#818cf8] text-white px-4 py-2 rounded-md text-xs font-semibold transition-all">
                + Log Trade
              </button>
            </div>

            {/* MarketStatusBar */}
            <div className="bg-[#121215] border border-[#1a1a1e] px-4 py-3 rounded-lg flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#fafafa] bg-[#18181c] px-1.5 py-1 rounded">VNINDEX</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                  <span className="text-xs font-semibold text-[#10b981] uppercase tracking-wider">Gate 1 Pass</span>
                </div>
              </div>
              <div className="text-xs text-[#52525b] font-mono">
                Sync Status: Fresh
              </div>
            </div>

            {/* Risk warnings */}
            <div className="bg-[#121215] border border-[#1a1a1e] border-l-4 border-l-[#f97316] rounded-lg p-3 px-4 flex justify-between items-center shadow">
              <div className="flex items-center gap-3">
                <span className="bg-[rgba(249,115,22,0.12)] text-[#f97316] text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">POSITION RISK</span>
                <span className="text-xs text-[#a1a1aa]">
                  Open trade on <strong className="text-[#fafafa] font-mono">HPG</strong> is missing stop-loss level protection. Risk cannot be calculated.
                </span>
              </div>
              <span className="text-[#f97316] text-xs font-semibold hover:underline cursor-pointer">Configure Stop &rarr;</span>
            </div>

            {/* Ledger Filters */}
            <div className="bg-[#121215] border border-[#1a1a1e] rounded-lg p-4 flex flex-col gap-3 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Search by symbol (e.g. HPG, TCB)..."
                  className="bg-[#09090b] border border-[#1f1f23] rounded-lg px-3 py-2 text-xs text-[#fafafa] outline-none focus:border-[#6366f1] transition-all"
                  value="TCB"
                  readOnly
                />
                
                <select className="bg-[#09090b] border border-[#1f1f23] rounded-lg px-3 py-2 text-xs text-[#fafafa] cursor-pointer outline-none focus:border-[#6366f1]">
                  <option>All Statuses</option>
                  <option>OPEN Positions</option>
                  <option selected>CLOSED Trades</option>
                  <option>PLANNED Setups</option>
                </select>

                <select className="bg-[#09090b] border border-[#1f1f23] rounded-lg px-3 py-2 text-xs text-[#fafafa] cursor-pointer outline-none focus:border-[#6366f1]">
                  <option>All Playbooks</option>
                  <option>Breakout</option>
                  <option>Pullback MA20</option>
                  <option>Breakdown</option>
                </select>

                <select className="bg-[#09090b] border border-[#1f1f23] rounded-lg px-3 py-2 text-xs text-[#fafafa] cursor-pointer outline-none focus:border-[#6366f1]">
                  <option>All Dates (30 Days)</option>
                  <option>This Week</option>
                  <option>This Month</option>
                </select>
              </div>

              {/* Chips + Clear All */}
              <div className="border-t border-[#1f1f23] pt-3 flex justify-between items-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider">Active Filters:</span>
                  
                  <div className="bg-[#18181c] border border-[#1f1f23] rounded px-2 py-0.5 text-xs flex items-center gap-1.5">
                    <span className="text-[#71717a]">Symbol:</span> <span className="font-mono font-bold">TCB</span>
                    <span className="text-[#ef4444] cursor-pointer font-bold hover:text-white">&times;</span>
                  </div>

                  <div className="bg-[#18181c] border border-[#1f1f23] rounded px-2 py-0.5 text-xs flex items-center gap-1.5">
                    <span className="text-[#71717a]">Status:</span> <span className="font-bold">CLOSED</span>
                    <span className="text-[#ef4444] cursor-pointer font-bold hover:text-white">&times;</span>
                  </div>
                </div>
                
                <button className="text-[#6366f1] text-xs font-semibold hover:underline cursor-pointer">
                  Clear All Filters
                </button>
              </div>

            </div>

            {/* Ledger Table */}
            <div className="border border-[#1a1a1e] rounded-lg overflow-hidden shadow-lg bg-[#121215]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="bg-[#18181c] border-b border-[#1f1f23] text-[#71717a] text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-4">Direction</th>
                      <th className="py-3 px-4">Playbook</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Entry Date</th>
                      <th className="py-3 px-4 text-right">Entry Price</th>
                      <th className="py-3 px-4 text-right">Exit Price</th>
                      <th className="py-3 px-4 text-right">Qty</th>
                      <th className="py-3 px-4 text-right">Realized P&amp;L</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#1a1a1e] hover:bg-[#18181c] transition-all cursor-pointer">
                      <td className="py-3 px-4 font-mono font-bold text-[#fafafa]">TCB</td>
                      <td className="py-3 px-4"><span className="text-[#22c55e] bg-[rgba(34,197,94,0.1)] px-1.5 py-0.5 rounded font-bold font-mono text-[9px]">LONG</span></td>
                      <td className="py-3 px-4 text-[#a1a1aa]">Breakout &rarr; Pullback</td>
                      <td className="py-3 px-4"><span className="bg-[#27272a] text-[#fafafa] px-1.5 py-0.5 rounded font-bold text-[9px]">CLOSED</span></td>
                      <td className="py-3 px-4 text-[#71717a]">2026-05-15</td>
                      <td className="py-3 px-4 text-right font-mono text-[#a1a1aa]">45.40</td>
                      <td className="py-3 px-4 text-right font-mono text-[#a1a1aa]">48.90</td>
                      <td className="py-3 px-4 text-right font-mono text-[#a1a1aa]">3,000</td>
                      <td className="py-3 px-4 text-right font-mono text-[#10b981] font-bold">+10,500k ₫</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#6366f1] hover:underline text-xs font-semibold">Edit</span>
                      </td>
                    </tr>
                    <tr className="border-b border-[#1a1a1e] hover:bg-[#18181c] transition-all cursor-pointer">
                      <td className="py-3 px-4 font-mono font-bold text-[#fafafa]">TCB</td>
                      <td className="py-3 px-4"><span className="text-[#22c55e] bg-[rgba(34,197,94,0.1)] px-1.5 py-0.5 rounded font-bold font-mono text-[9px]">LONG</span></td>
                      <td className="py-3 px-4 text-[#a1a1aa]">Breakout &rarr; Support Hold</td>
                      <td className="py-3 px-4"><span className="bg-[#27272a] text-[#fafafa] px-1.5 py-0.5 rounded font-bold text-[9px]">CLOSED</span></td>
                      <td className="py-3 px-4 text-[#71717a]">2026-05-02</td>
                      <td className="py-3 px-4 text-right font-mono text-[#a1a1aa]">42.10</td>
                      <td className="py-3 px-4 text-right font-mono text-[#a1a1aa]">44.30</td>
                      <td className="py-3 px-4 text-right font-mono text-[#a1a1aa]">4,000</td>
                      <td className="py-3 px-4 text-right font-mono text-[#10b981] font-bold">+8,800k ₫</td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[#6366f1] hover:underline text-xs font-semibold">Edit</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Filter-empty state */}
            <div className="border-t border-[#1a1a1e] pt-4">
              <span className="text-[10px] font-bold text-[#71717a] uppercase tracking-wider block mb-2">Filter-Empty State Preview</span>
              
              <div className="bg-[#121215] border border-dashed border-[#1c1c22] p-6 rounded-lg text-center flex flex-col items-center justify-center shadow-lg">
                <div className="w-8 h-8 rounded-full bg-[rgba(99,102,241,0.08)] flex items-center justify-center mb-2 border border-[rgba(99,102,241,0.15)]">
                  <svg className="w-4 h-4 text-[#6366f1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <h4 className="text-xs font-bold text-[#fafafa] mb-1">No Trades Match Filters</h4>
                <p className="text-[11px] text-[#a1a1aa] max-w-xs leading-relaxed mb-3">
                  No logged records match your search for ticker <strong className="text-white">&quot;TCB&quot;</strong> with status <strong className="text-white">&quot;CLOSED&quot;</strong>.
                </p>
                <button className="bg-[#18181c] border border-[#27272a] hover:bg-[#202026] text-[#fafafa] text-[10px] px-3 py-1 rounded transition-all">
                  Reset Filter Query
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
