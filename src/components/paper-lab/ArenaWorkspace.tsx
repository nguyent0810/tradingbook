"use client";

import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AgentPortfolioRail } from "./AgentPortfolioRail";
import { ArenaTradingStanceBanner } from "./ArenaTradingStanceBanner";
import { DecisionsLogTable } from "./DecisionsLogTable";
import { MarketRegimeExplanationCard } from "./MarketRegimeExplanationCard";
import { PaperLabHeaderGrid } from "./PaperLabHeaderGrid";
import { PaperLabWorkspaceTabs } from "./PaperLabWorkspaceTabs";
import { HumanPmForm } from "./HumanPmForm";
import { PaperLabSidebar } from "./PaperLabSidebar";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";
import "./paper-lab-command-center.css";
import "./paper-lab-workstation.css";

export type ArenaHumanCall = { id: string; symbol: string; action: string; reasoning: string; kind: "accepted" | "override" };

export type ArenaLearning = {
  humanCalls: ArenaHumanCall[];
  battles: { id: string; session: string; symbol: string; status: string; agents: number; bench: string }[];
  achievements: { id: string; type: string; agent: string; session: string; symbol: string; value: number }[];
  experiments: { id: string; name: string; type: string; status: string; arms: number; started: string }[];
  timeline: { id: string; session: string; decisions: number; battles: number }[];
};

const FOCUS_TO_SECTION: Record<string, string> = {
  now: "arena-now", consensus: "arena-consensus", conflict: "arena-conflict",
  battles: "arena-conflict", decision: "arena-decision", human: "arena-decision",
  learning: "arena-learning", experiments: "arena-learning", hof: "arena-learning", timeline: "arena-learning",
};

type Camp = "buy" | "hold" | "sell";
const campOf = (a: string): Camp =>
  a === "BUY" || a === "ADD" ? "buy" : a === "SELL" || a === "EXIT" || a === "REDUCE" ? "sell" : "hold";
const campTone = (c: Camp) => (c === "buy" ? "pos" : c === "sell" ? "neg" : "neutral");
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const conf = (c: number | null) => (c == null ? "—" : `${Math.round(c * 100)}%`);

export function ArenaWorkspace({
  data,
  learning,
  focus,
}: {
  data: PaperLabPageDto;
  learning: ArenaLearning;
  focus?: string | null;
}) {
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  const filteredPositions = useMemo(
    () => (agentFilter ? data.positions.filter((p) => p.agentId === agentFilter) : data.positions),
    [data.positions, agentFilter]
  );

  const styleOf = useMemo(() => {
    const m = new Map<string, string>();
    data.portfolios.forEach((p) => m.set(p.agentId, p.style));
    return m;
  }, [data.portfolios]);

  // Each agent's headline call today (their most-conviction decision).
  const agentToday = useMemo(() => {
    const m = new Map<string, { action: string; confidence: number; symbol: string }>();
    for (const d of data.decisions) {
      const cur = m.get(d.agentId);
      if (!cur || d.confidence > cur.confidence) m.set(d.agentId, { action: d.action, confidence: d.confidence, symbol: d.symbol });
    }
    return m;
  }, [data.decisions]);

  // League standings — one row per fund, ranked, self-describing (no drawer needed).
  const standings = useMemo(() => {
    const lb = new Map(data.leaderboard.map((r) => [r.agentId, r]));
    const rows = data.portfolios.map((p) => {
      const r = lb.get(p.agentId);
      const t = agentToday.get(p.agentId);
      return {
        agentId: p.agentId, name: p.agentName, philosophy: p.style,
        returnPct: p.pnlPct, drawdown: p.maxDrawdownPct, winRate: p.winRate,
        rank: r?.rank ?? 0, rankChange: r?.rankChange ?? 0,
        action: t?.action ?? null, confidence: t?.confidence ?? null,
      };
    });
    rows.sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.returnPct - a.returnPct);
    rows.forEach((r, i) => { if (!r.rank) r.rank = i + 1; });
    return rows.map((r) => ({
      ...r,
      status: r.rank === 1 ? "Champion" : r.rankChange > 0 ? "Climbing" : r.rankChange < 0 ? "Falling" : r.drawdown > 12 ? "At risk" : "Holding",
    }));
  }, [data.portfolios, data.leaderboard, agentToday]);

  const champion = standings[0] ?? null;
  const mover = useMemo(() => [...standings].sort((a, b) => b.rankChange - a.rankChange || b.returnPct - a.returnPct)[0] ?? null, [standings]);
  const loser = useMemo(() => [...standings].sort((a, b) => a.rankChange - b.rankChange || a.returnPct - b.returnPct)[0] ?? null, [standings]);

  const agreement = useMemo(() => {
    const camps = { buy: 0, hold: 0, sell: 0 };
    for (const [, t] of agentToday) camps[campOf(t.action)]++;
    const total = camps.buy + camps.hold + camps.sell;
    const top = Math.max(camps.buy, camps.hold, camps.sell);
    let confSum = 0, n = 0;
    for (const [, t] of agentToday) { confSum += t.confidence; n++; }
    return { pct: total ? Math.round((top / total) * 100) : 0, camps, total, avgConf: n ? Math.round((confSum / n) * 100) : 0 };
  }, [agentToday]);

  const cioRecs = data.cio.recommendations;
  const opportunity = useMemo(() => cioRecs.filter((r) => campOf(r.finalAction) === "buy").sort((a, b) => b.confidence - a.confidence)[0] ?? null, [cioRecs]);
  const danger = useMemo(() => cioRecs.filter((r) => campOf(r.finalAction) === "sell").sort((a, b) => b.confidence - a.confidence)[0] ?? null, [cioRecs]);
  const cioTop = useMemo(() => [...cioRecs].sort((a, b) => b.confidence - a.confidence)[0] ?? null, [cioRecs]);

  // The great debate — the most-contested symbol, agents grouped into camps.
  const topConflict = useMemo(() => {
    let best: (typeof data.recentBattles)[number] | null = null;
    let spread = -1;
    for (const b of data.recentBattles) {
      const v = b.voteCounts;
      const total = v.buy + v.hold + v.sell + v.reduce;
      if (total < 2) continue;
      const s = total - Math.max(v.buy, v.hold, v.sell, v.reduce);
      if (s > spread) { spread = s; best = b; }
    }
    return best;
  }, [data]);

  const debate = useMemo(() => {
    let symbol = topConflict?.symbol ?? null;
    if (!symbol) {
      // fall back to the symbol whose decisions split across the most camps
      const bySym = new Map<string, Set<Camp>>();
      for (const d of data.decisions) {
        if (!bySym.has(d.symbol)) bySym.set(d.symbol, new Set());
        bySym.get(d.symbol)!.add(campOf(d.action));
      }
      symbol = [...bySym.entries()].sort((a, b) => b[1].size - a[1].size)[0]?.[0] ?? null;
    }
    if (!symbol) return null;
    const rows = data.decisions.filter((d) => d.symbol === symbol);
    const camps: Record<Camp, { name: string; philosophy: string; action: string; confidence: number; reason: string }[]> = { buy: [], hold: [], sell: [] };
    for (const d of rows) {
      camps[campOf(d.action)].push({ name: d.agentName, philosophy: styleOf.get(d.agentId) ?? "—", action: d.action, confidence: d.confidence, reason: d.reasoningSummary });
    }
    const cioRec = cioRecs.find((r) => r.symbol === symbol) ?? null;
    return { symbol, camps, cioRec, count: rows.length };
  }, [topConflict, data, cioRecs, styleOf]);

  // Human PM control room — AI consensus → your call → pending review.
  const controlRoom = useMemo(
    () => learning.humanCalls.map((c) => {
      const ai = cioRecs.find((r) => r.symbol === c.symbol) ?? null;
      return { ...c, aiAction: ai?.finalAction ?? null, aiConfidence: ai?.confidence ?? null, agrees: ai ? campOf(ai.finalAction) === campOf(c.action) : null };
    }),
    [learning.humanCalls, cioRecs]
  );

  const awards = useMemo(() => ({
    champion,
    improved: [...standings].sort((a, b) => b.rankChange - a.rankChange)[0] ?? null,
    worstDd: [...standings].sort((a, b) => b.drawdown - a.drawdown)[0] ?? null,
    specialist: learning.achievements.find((a) => /accurate|regime/i.test(a.type)) ?? null,
    record: learning.achievements.find((a) => /multiple|streak|return|recovery/i.test(a.type)) ?? null,
    experiment: learning.experiments[0] ?? null,
    sessions: learning.timeline.length,
  }), [champion, standings, learning]);

  useEffect(() => {
    if (!focus) return;
    const target = FOCUS_TO_SECTION[focus];
    if (!target) return;
    const t1 = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "auto", block: "start" }), 80);
    const t2 = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "auto", block: "start" }), 350);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [focus]);

  return (
    <div className="arena-page" data-testid="paper-lab-arena">
      <PaperLabSidebar />
      <div className="arena-zones">
        {/* ═══ NOW — Today's Arena Briefing ═══ */}
        <section id="arena-now" className="arena-zone" aria-labelledby="arena-now-h">
          <ZoneHead n="01" kicker="What is happening?" id="arena-now-h" title="Today's Arena Briefing"
            lead="If ten investment philosophies managed capital today — here is who is leading, the environment they are trading, and the house view." />

          <ArenaTradingStanceBanner decision={data.overview.tradingDecision} />

          <div className="arena-briefing">
            <BriefingCard kind="leader" label="Today's leader" hint="Who is winning">
              {champion ? (<>
                <span className="arena-briefing__title">{champion.name}</span>
                <span className="arena-briefing__meta">{champion.philosophy} · <b className={champion.returnPct >= 0 ? "pos" : "neg"}>{fmtPct(champion.returnPct)}</b></span>
              </>) : <span className="arena-briefing__meta">No standings yet</span>}
            </BriefingCard>

            <BriefingCard kind="env" label="Environment" hint="The market they trade">
              <span className={`arena-briefing__title arena-regime--${(data.overview.marketRegime.level ?? "WARNING").toLowerCase()}`}>{data.overview.marketRegime.level ?? "—"}</span>
              <span className="arena-briefing__meta">{data.overview.marketRegime.labels?.slice(0, 3).join(" · ") || data.overview.marketRegime.label}</span>
            </BriefingCard>

            <BriefingCard kind="opportunity" label="Biggest opportunity" hint="Where conviction points">
              {opportunity ? (<>
                <span className="arena-briefing__title pos">{opportunity.symbol} · {opportunity.finalAction}</span>
                <span className="arena-briefing__meta">{conf(opportunity.confidence)} conviction — {opportunity.decisionSummary ?? opportunity.reasoning}</span>
              </>) : <span className="arena-briefing__meta">No strong buy consensus today</span>}
            </BriefingCard>

            <BriefingCard kind="danger" label="Biggest danger" hint="What to avoid">
              {danger ? (<>
                <span className="arena-briefing__title neg">{danger.symbol} · {danger.finalAction}</span>
                <span className="arena-briefing__meta">{conf(danger.confidence)} conviction — {danger.decisionSummary ?? danger.reasoning}</span>
              </>) : loser ? (<>
                <span className="arena-briefing__title neg">{loser.name}</span>
                <span className="arena-briefing__meta">{loser.philosophy} is bleeding — {fmtPct(loser.returnPct)}, drawdown {loser.drawdown.toFixed(1)}%</span>
              </>) : <span className="arena-briefing__meta">No acute risk flagged</span>}
            </BriefingCard>
          </div>

          {cioTop && (
            <p className="arena-briefing__verdict">
              <span className="arena-briefing__verdict-tag">CIO conclusion</span>
              {cioTop.decisionSummary ?? cioTop.reasoning}
            </p>
          )}

          {/* Supporting detail — regime, market pulse, full CIO panel */}
          <section className="paper-lab-arena-hero" data-testid="paper-lab-arena-hero">
            <PaperLabHeaderGrid overview={data.overview} cio={data.cio} />
          </section>
          <MarketRegimeExplanationCard regime={data.overview.marketRegime} />
        </section>

        {/* ═══ CONSENSUS — League Standings ═══ */}
        <section id="arena-consensus" className="arena-zone" aria-labelledby="arena-consensus-h">
          <ZoneHead n="02" kicker="Who agrees?" id="arena-consensus-h" title="League Standings"
            lead="Ten philosophies, one scoreboard. Who is climbing, who is falling, and how much the league agrees today." />

          <div className="arena-podium">
            <PodiumCard rank="Champion" tone="gold" name={champion?.name} sub={champion ? `${champion.philosophy} · ${fmtPct(champion.returnPct)}` : "—"} />
            <PodiumCard rank="Biggest mover" tone="up" name={mover?.name} sub={mover ? `${mover.philosophy} · ${mover.rankChange > 0 ? `▲ ${mover.rankChange}` : "steady"}` : "—"} />
            <PodiumCard rank="Biggest faller" tone="down" name={loser?.name} sub={loser ? `${loser.philosophy} · ${loser.rankChange < 0 ? `▼ ${Math.abs(loser.rankChange)}` : fmtPct(loser.returnPct)}` : "—"} />
            <PodiumCard rank="League agreement" tone="cyan" name={`${agreement.pct}%`} sub={`avg conviction ${agreement.avgConf}% · ${agreement.total} calls`} />
          </div>

          <div className="paper-lab-panel arena-standings" aria-label="League table">
            <div className="paper-lab-panel__title-row">
              <h3 className="paper-lab-panel__title">League table</h3>
              <span className="arena-standings__hint">Return · today&apos;s call · conviction · status</span>
            </div>
            <div className="safe-table-wrap paper-lab-table-wrap">
              <table className="paper-lab-table safe-table arena-standings__table">
                <thead><tr><th>#</th><th>Fund</th><th>Philosophy</th><th>Return</th><th>Today</th><th>Conv.</th><th>Status</th></tr></thead>
                <tbody>
                  {standings.map((r) => (
                    <tr key={r.agentId}>
                      <td className="tabular-nums arena-standings__rank">{r.rank}</td>
                      <td className="arena-standings__name">{r.name}</td>
                      <td><span className="arena-chip">{r.philosophy}</span></td>
                      <td className={`tabular-nums ${r.returnPct >= 0 ? "pos" : "neg"}`}>{fmtPct(r.returnPct)}</td>
                      <td>{r.action ? <span className={`arena-act arena-act--${campTone(campOf(r.action))}`}>{r.action}</span> : <span className="arena-muted">—</span>}</td>
                      <td className="tabular-nums arena-muted">{conf(r.confidence)}</td>
                      <td><span className={`arena-status arena-status--${r.status.toLowerCase().replace(/\s/g, "")}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* The grid of funds (drawer detail) + the full decision book */}
          <AgentPortfolioRail
            portfolios={data.portfolios}
            activeAgentId={agentFilter}
            variant="fund-strip"
            onSelectAgent={(id) => setAgentFilter((prev) => (prev === id ? null : id))}
          />
          {agentFilter && (
            <button type="button" className="paper-lab-link-btn text-xs mb-3" onClick={() => setAgentFilter(null)}>
              Clear filter: {data.portfolios.find((p) => p.agentId === agentFilter)?.agentName}
            </button>
          )}
          <DecisionsLogTable decisions={data.decisions} />
        </section>

        {/* ═══ CONFLICT — Today's Biggest Debate ═══ */}
        <section id="arena-conflict" className="arena-zone" aria-labelledby="arena-conflict-h">
          <ZoneHead n="03" kicker="Who disagrees?" id="arena-conflict-h" title="Today's Biggest Debate"
            lead="The emotional centre of the Arena — where philosophies collide on the same stock, and why." />

          {debate ? (
            <div className="arena-debate">
              <div className="arena-debate__head">
                <span className="arena-debate__tag">The floor is split on</span>
                <span className="arena-debate__sym">{debate.symbol}</span>
                <span className="arena-debate__count">{debate.count} agents weighing in</span>
              </div>
              <div className="arena-debate__camps">
                {(["buy", "hold", "sell"] as Camp[]).map((c) => (
                  <DebateCamp key={c} camp={c} members={debate.camps[c]} />
                ))}
              </div>
              {debate.cioRec && (
                <div className="arena-debate__verdict">
                  <span className="arena-debate__verdict-tag">Why — CIO ruling</span>
                  <span className={`arena-act arena-act--${campTone(campOf(debate.cioRec.finalAction))}`}>{debate.cioRec.finalAction}</span>
                  <p>{debate.cioRec.reasoning}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="arena-empty">No open debate today — the league is aligned.</p>
          )}

          {/* Battle history (secondary) */}
          <details className="arena-more" open>
            <summary className="arena-more__summary">Battle history &amp; open book</summary>
            <PaperLabWorkspaceTabs positions={filteredPositions} battleReplay={data.battleReplay} recentBattles={data.recentBattles} />
            {learning.battles.length > 0 && (
              <div className="paper-lab-panel arena-learning-panel" data-testid="paper-lab-battles-ledger">
                <h3 className="paper-lab-panel__title">Battle ledger</h3>
                <div className="safe-table-wrap paper-lab-table-wrap">
                  <table className="paper-lab-table safe-table">
                    <thead><tr><th>Session</th><th>Symbol</th><th>Status</th><th>Agents</th><th>5d bench</th></tr></thead>
                    <tbody>
                      {learning.battles.map((b) => (
                        <tr key={b.id}>
                          <td className="tabular-nums">{b.session}</td>
                          <td><Link href={`/paper-lab/battles/${b.id}`} className="arena-deeplink">{b.symbol}</Link></td>
                          <td>{b.status}</td>
                          <td className="tabular-nums">{b.agents}</td>
                          <td className="tabular-nums">{b.bench}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </details>
        </section>

        {/* ═══ DECISION — Human PM Control Room ═══ */}
        <section id="arena-decision" className="arena-zone" aria-labelledby="arena-decision-h">
          <ZoneHead n="04" kicker="What would I do?" id="arena-decision-h" title="Human PM Control Room"
            lead="The AI league proposes. You dispose. Every call is scored against the machines on the same simulated capital." />

          <div className="paper-lab-panel arena-control" data-testid="paper-lab-human-review">
            <div className="paper-lab-panel__title-row">
              <h3 className="paper-lab-panel__title">Review queue</h3>
              <span className="arena-standings__hint">AI consensus → your call → pending outcome</span>
            </div>
            {controlRoom.length > 0 ? (
              <ul className="arena-flow-list">
                {controlRoom.map((c) => (
                  <li key={c.id} className="arena-flow">
                    <FlowStep label="AI consensus" value={c.aiAction ?? "—"} tone={c.aiAction ? campTone(campOf(c.aiAction)) : "neutral"} sub={conf(c.aiConfidence)} />
                    <span className="arena-flow__arrow" aria-hidden="true">→</span>
                    <FlowStep label="Human PM" value={c.action} tone={campTone(campOf(c.action))} sub={c.symbol} />
                    <span className="arena-flow__arrow" aria-hidden="true">→</span>
                    <FlowStep label="Outcome" value="Pending" tone="neutral" sub="review later" />
                    <span className={`arena-flow__verdict arena-flow__verdict--${c.agrees ? "agree" : "override"}`}>
                      {c.agrees ? "Accepted consensus" : "Override"}
                    </span>
                    <p className="arena-flow__reason">{c.reasoning}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="arena-empty">No human calls yet today. Add one below to enter the league.</p>
            )}
          </div>

          <details className="arena-more">
            <summary className="arena-more__summary">Add a discretionary call</summary>
            <div className="paper-lab-panel arena-decision-panel">
              <p className="arena-decision-panel__note">
                Human PM runs the same 500M ₫ simulated capital and validation as the AI agents. Your call is recorded and scored alongside them.
              </p>
              <HumanPmForm />
            </div>
          </details>
        </section>

        {/* ═══ LEARNING — Season Awards ═══ */}
        <section id="arena-learning" className="arena-zone" aria-labelledby="arena-learning-h">
          <ZoneHead n="05" kicker="What did we learn?" id="arena-learning-h" title="Season Awards"
            lead="The trophies of the season so far — and the evolution behind them." />

          <div className="arena-awards">
            <AwardCard trophy="🏆" title="Champion" name={awards.champion?.name} sub={awards.champion ? `${awards.champion.philosophy} · ${fmtPct(awards.champion.returnPct)}` : "—"} tone="gold" />
            <AwardCard trophy="📈" title="Most improved" name={awards.improved?.name} sub={awards.improved ? (awards.improved.rankChange > 0 ? `▲ ${awards.improved.rankChange} places` : awards.improved.philosophy) : "—"} tone="up" />
            <AwardCard trophy="🩸" title="Worst drawdown" name={awards.worstDd?.name} sub={awards.worstDd ? `−${awards.worstDd.drawdown.toFixed(1)}% · ${awards.worstDd.philosophy}` : "—"} tone="down" />
            <AwardCard trophy="🎯" title="Best regime specialist" name={awards.specialist?.agent} sub={awards.specialist ? `${awards.specialist.type} · ${awards.specialist.value.toFixed(2)}` : "No award yet"} tone="cyan" />
            <AwardCard trophy="🧪" title="Experiment winner" name={awards.experiment?.name} sub={awards.experiment ? `${awards.experiment.status} · ${awards.experiment.arms} arms` : "No experiments"} tone="purple" />
            <AwardCard trophy="🧬" title="Strategy evolution" name={`${awards.sessions} sessions`} sub={awards.record ? `record: ${awards.record.type} (${awards.record.agent})` : "tracked over time"} tone="cyan" />
          </div>

          <details className="arena-more" open>
            <summary className="arena-more__summary">Records, experiments &amp; timeline</summary>
            <div className="arena-learning-grid">
              <LearningPanel title="Experiments" empty="No experiments running.">
                {learning.experiments.length > 0 && (
                  <table className="paper-lab-table safe-table">
                    <thead><tr><th>Name</th><th>Status</th><th>Arms</th><th>Started</th></tr></thead>
                    <tbody>
                      {learning.experiments.map((e) => (
                        <tr key={e.id}><td>{e.name}</td><td>{e.status}</td><td className="tabular-nums">{e.arms}</td><td className="tabular-nums">{e.started}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </LearningPanel>

              <LearningPanel title="Evolution — sessions" empty="No sessions recorded yet.">
                {learning.timeline.length > 0 && (
                  <table className="paper-lab-table safe-table">
                    <thead><tr><th>Session</th><th>Decisions</th><th>Battles</th></tr></thead>
                    <tbody>
                      {learning.timeline.map((t) => (
                        <tr key={t.id}>
                          <td><Link href={`/paper-lab/timeline/${t.session}`} className="arena-deeplink">{t.session}</Link></td>
                          <td className="tabular-nums">{t.decisions}</td>
                          <td className="tabular-nums">{t.battles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </LearningPanel>

              <div className="paper-lab-panel arena-learning-panel" data-testid="paper-lab-leaderboard">
                <h3 className="paper-lab-panel__title">Hall of Fame</h3>
                {learning.achievements.length === 0 ? (
                  <p className="arena-empty">No records set yet.</p>
                ) : (
                  <div className="safe-table-wrap paper-lab-table-wrap">
                    <table className="paper-lab-table safe-table">
                      <thead><tr><th>Achievement</th><th>Agent</th><th>Session</th><th>Value</th></tr></thead>
                      <tbody>
                        {learning.achievements.map((a) => (
                          <tr key={a.id}><td>{a.type}</td><td>{a.agent}</td><td className="tabular-nums">{a.session}</td><td className="tabular-nums">{a.value.toFixed(2)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

function ZoneHead({ n, kicker, id, title, lead }: { n: string; kicker: string; id: string; title: string; lead: string }) {
  return (
    <header className="arena-zone__head">
      <span className="arena-zone__num" aria-hidden="true">{n}</span>
      <div>
        <span className="arena-zone__kicker">{kicker}</span>
        <h2 id={id} className="arena-zone__title">{title}</h2>
        <p className="arena-zone__lead">{lead}</p>
      </div>
    </header>
  );
}

function BriefingCard({ kind, label, hint, children }: { kind: string; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className={`arena-briefing-card arena-briefing-card--${kind}`}>
      <div className="arena-briefing-card__label">{label}</div>
      <div className="arena-briefing-card__body">{children}</div>
      <div className="arena-briefing-card__hint">{hint}</div>
    </div>
  );
}

function PodiumCard({ rank, tone, name, sub }: { rank: string; tone: string; name?: string; sub: string }) {
  return (
    <div className={`arena-podium-card arena-podium-card--${tone}`}>
      <span className="arena-podium-card__rank">{rank}</span>
      <span className="arena-podium-card__name">{name ?? "—"}</span>
      <span className="arena-podium-card__sub">{sub}</span>
    </div>
  );
}

function DebateCamp({ camp, members }: { camp: Camp; members: { name: string; philosophy: string; action: string; confidence: number; reason: string }[] }) {
  const heading = camp === "buy" ? "Buy" : camp === "sell" ? "Sell / Reduce" : "Hold";
  return (
    <div className={`arena-camp arena-camp--${campTone(camp)}`}>
      <div className="arena-camp__head">
        <span className="arena-camp__verdict">{heading}</span>
        <span className="arena-camp__count">{members.length}</span>
      </div>
      {members.length === 0 ? (
        <EmptyStateWithReason
          compact
          title="No takers"
          reason="No agents are recommending this move right now."
        />
      ) : (
        <ul className="arena-camp__list">
          {members.map((m, i) => (
            <li key={i} className="arena-camp__member">
              <span className="arena-camp__who"><b>{m.philosophy}</b> · {conf(m.confidence)}</span>
              <span className="arena-camp__reason">{m.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowStep({ label, value, tone, sub }: { label: string; value: string; tone: string; sub: string }) {
  return (
    <div className="arena-flow__step">
      <span className="arena-flow__label">{label}</span>
      <span className={`arena-flow__value arena-act arena-act--${tone}`}>{value}</span>
      <span className="arena-flow__sub">{sub}</span>
    </div>
  );
}

function AwardCard({ trophy, title, name, sub, tone }: { trophy: string; title: string; name?: string; sub: string; tone: string }) {
  return (
    <div className={`arena-award arena-award--${tone}`}>
      <span className="arena-award__trophy" aria-hidden="true">{trophy}</span>
      <span className="arena-award__title">{title}</span>
      <span className="arena-award__name">{name ?? "—"}</span>
      <span className="arena-award__sub">{sub}</span>
    </div>
  );
}

function LearningPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <div className="paper-lab-panel arena-learning-panel">
      <h3 className="paper-lab-panel__title">{title}</h3>
      {hasContent ? <div className="safe-table-wrap paper-lab-table-wrap">{children}</div> : <p className="arena-empty">{empty}</p>}
    </div>
  );
}
