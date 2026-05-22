"use client";

import { useState } from "react";
import Link from "next/link";
import {
  EmptyState,
  MarketCard,
  OrderBook,
  OrderPanel,
  PortfolioKpiStrip,
  PortfolioSummary,
  SkeletonTableRows,
  StatCard,
  WatchlistTable,
} from "@/components/ui";
import { PageHeader } from "@/components/shell/page-header";
import {
  PREVIEW_ASKS,
  PREVIEW_BIDS,
  PREVIEW_MARKET_CARDS,
  PREVIEW_WATCHLIST,
} from "./preview-data";

type PreviewState = "default" | "loading" | "empty" | "error";

export function DesignPreviewSections() {
  const [state, setState] = useState<PreviewState>("default");

  return (
    <div className="page-container animate-in space-y-12 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6" style={{ borderColor: "var(--border-primary)" }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent-text)" }}>
            Design DNA — Hybrid Modern Trading
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            UI Preview
          </h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--text-tertiary)" }}>
            Isolated mockups with dummy data. Not connected to auth, scanner, or trade APIs.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">
          ← Production app
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["default", "loading", "empty", "error"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn btn-sm ${state === s ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setState(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {state === "error" ? (
        <div role="alert" className="alert-warning px-4 py-3 text-sm">
          Preview error state — failed to load market snapshot (simulated).
        </div>
      ) : null}

      {/* 1 Dashboard / Portfolio */}
      <section className="space-y-4" id="portfolio">
        <PageHeader
          title="Portfolio overview"
          subtitle="Robinhood-inspired clarity with journal-specific KPIs"
        />
        {state === "loading" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="metric-card">
                <div className="skeleton mb-2 h-3 w-24" />
                <div className="skeleton h-8 w-32" />
              </div>
            ))}
          </div>
        ) : (
          <PortfolioKpiStrip
            closedTrades={42}
            openPositions={3}
            winRate={58}
            cumulativePnl={12_450_000}
            formatPnl={(n) =>
              new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n)
            }
          />
        )}
        <div className="card-elevated p-5">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            Today&apos;s action
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Normal risk
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Max exposure guidance: 60–80% — selective probes with discipline.
          </p>
        </div>
        <PortfolioSummary
          exposure="₫245,000,000"
          allocationGuide="60–80%"
          perTradeGuide="10–20%"
          stance="Normal risk with discipline."
          openCount={3}
        />
      </section>

      {/* 2 Market watchlist */}
      <section className="space-y-4" id="watchlist">
        <PageHeader title="Market watchlist" subtitle="Apple Stocks–style scan density" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_MARKET_CARDS.map((c) => (
            <MarketCard key={c.symbol} {...c} />
          ))}
        </div>
        {state === "loading" ? (
          <div className="table-container">
            <SkeletonTableRows rows={5} cols={6} />
          </div>
        ) : state === "empty" ? (
          <EmptyState
            title="No active watch items"
            description="Run the daily scan or add symbols from Setups."
            action={<button type="button" className="btn btn-primary btn-sm">Open Setups</button>}
          />
        ) : (
          <WatchlistTable rows={PREVIEW_WATCHLIST} />
        )}
      </section>

      {/* 3 Trading screen */}
      <section className="space-y-4" id="trading">
        <PageHeader
          title="Trading workstation"
          subtitle="Chart + order book + journal panel (Binance density, journal semantics)"
        />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="chart-panel lg:col-span-8 flex min-h-[320px] flex-col items-center justify-center p-6">
            {state === "loading" ? (
              <div className="skeleton h-full w-full min-h-[240px]" />
            ) : (
              <>
                <p className="text-sm font-medium" style={{ color: "var(--text-tertiary)" }}>
                  Chart area placeholder
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Production uses equity / bar data — TradingView-style density without embedding TV
                </p>
                <div className="mt-6 flex gap-8 font-mono text-sm tabular-nums">
                  <span className="price-up">H 129.10</span>
                  <span style={{ color: "var(--text-secondary)" }}>L 126.80</span>
                  <span style={{ color: "var(--text-primary)" }}>C 128.50</span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-4 lg:col-span-4">
            {state === "loading" ? (
              <div className="panel p-4">
                <div className="skeleton mb-3 h-4 w-20" />
                <div className="skeleton h-32 w-full" />
              </div>
            ) : (
              <OrderBook bids={PREVIEW_BIDS} asks={PREVIEW_ASKS} spread="0.20" />
            )}
            <OrderPanel symbol="FPT" mode="preview" />
          </div>
        </div>
      </section>

      {/* 4 Asset detail */}
      <section className="space-y-4" id="asset">
        <PageHeader title="Asset detail" subtitle="Setup-ready vs watch-only lanes" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel-elevated p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-mono text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  FPT
                </h3>
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  FPT Corporation · HOSE
                </p>
              </div>
              <span className="badge badge-long">Setup ready</span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <StatCard label="Close (1000₫)" value="128.50" />
              <StatCard label="Zone" value="125.0 – 127.5" trend="neutral" />
              <StatCard label="Stop" value="121.20" />
              <StatCard label="Health" value="Healthy (82)" trend="up" />
            </dl>
            <p className="mt-4 rounded-md border px-3 py-2 text-xs leading-relaxed" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
              Core scanner Tier A — eligible for Create Trade workflow. Not momentum-watch only.
            </p>
          </div>
          <div className="panel border-dashed p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-mono text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                  VJC
                </h3>
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  Vietjet · Momentum watch only
                </p>
              </div>
              <span className="badge" style={{ background: "var(--warning-muted)", color: "var(--warning)" }}>
                Watch only
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <li>
                <span className="font-semibold text-amber-400">EXTENDED</span> — no pullback yet
              </li>
              <li>Volume ratio 20D: 2.1×</li>
              <li>Why not setup: reclaim thrust without zone retest</li>
            </ul>
            <button type="button" className="btn btn-secondary btn-sm mt-4">
              View details
            </button>
          </div>
        </div>
      </section>

      {/* 5 Mobile */}
      <section className="space-y-4" id="mobile">
        <PageHeader title="Mobile layout" subtitle="Stacked panels under 768px" />
        <div className="mx-auto max-w-[390px] rounded-2xl border p-2 shadow-[var(--shadow-lg)]" style={{ borderColor: "var(--border-secondary)" }}>
          <div className="rounded-xl p-3" style={{ background: "var(--bg-secondary)" }}>
            <div className="mb-3 flex items-center justify-between text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>TradeLog</span>
              <span>9:41</span>
            </div>
            <StatCard label="Today" value="Probe only" />
            <div className="mt-3 space-y-2">
              {PREVIEW_MARKET_CARDS.slice(0, 2).map((c) => (
                <MarketCard key={c.symbol} {...c} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg p-1 text-center text-[10px]" style={{ background: "var(--bg-primary)" }}>
              {["Home", "Setups", "Trades"].map((l, i) => (
                <span
                  key={l}
                  className={`rounded py-2 ${i === 0 ? "nav-link-active" : ""}`}
                  style={{ color: i === 0 ? undefined : "var(--text-tertiary)" }}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
