/**
 * DEV-ONLY Arena demo seed — makes every Arena workspace zone render with
 * meaningful data: "If the AI league managed capital today, what would happen?"
 *
 * Safe / idempotent / removable:
 *  - Refuses to run unless DATABASE_URL points at localhost/127.0.0.1.
 *  - All rows are tagged DEV_ARENA_SEED (JSON metadata) and scoped to SEED_DATE;
 *    the script deletes its own tagged/date-scoped rows before recreating, so
 *    re-running is a clean upsert (no duplicates).
 *  - Cleanup: `npx tsx scripts/dev/seed-arena-dev.ts --clean`
 *  - Preserves all simulation/business logic — writes DB rows only.
 *
 * Run: `npx tsx scripts/dev/seed-arena-dev.ts`
 */
import "../load-env";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { seedPaperAgents } from "../seed-paper-agents-lib";
import { PAPER_AGENT_SEEDS, PAPER_INITIAL_CAPITAL_VND } from "../../src/lib/paper-lab/constants";

const SEED_TAG = "DEV_ARENA_SEED";
const SEED_DATE = new Date(Date.UTC(2026, 6, 3)); // 2026-07-03 (matches dashboard anchor)
const CAP = PAPER_INITIAL_CAPITAL_VND;

function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  const masked = url.replace(/:[^:@/]+@/, ":***@");
  if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
    throw new Error(`Refusing to seed: DATABASE_URL is not localhost — got ${masked}. DEV ONLY.`);
  }
  if (/neon\.tech|amazonaws|supabase|\.render\.com/i.test(url)) {
    throw new Error(`Refusing to seed: DATABASE_URL looks hosted — ${masked}.`);
  }
}

const dateAt = (daysBefore: number) =>
  new Date(SEED_DATE.getTime() - daysBefore * 86_400_000);

// 9 AI agents (excl. cio): name, style, and a hand-tuned performance profile.
const AI_SLUGS = PAPER_AGENT_SEEDS.filter((a) => a.slug !== "cio").map((a) => a.slug);
const PROFILES: Record<string, { ret: number; win: number; dd: number; sharpe: number; trades: number; open: number }> = {
  aggressive_investor: { ret: 18.4, win: 0.62, dd: 11.2, sharpe: 1.6, trades: 28, open: 4 },
  momentum_investor: { ret: 12.1, win: 0.58, dd: 8.4, sharpe: 1.3, trades: 22, open: 3 },
  trend_follower: { ret: 9.3, win: 0.55, dd: 6.1, sharpe: 1.1, trades: 18, open: 3 },
  swing_trader: { ret: 6.8, win: 0.51, dd: 7.0, sharpe: 0.9, trades: 20, open: 2 },
  value_investor: { ret: 3.2, win: 0.49, dd: 4.4, sharpe: 0.6, trades: 9, open: 2 },
  safe_investor: { ret: 1.1, win: 0.46, dd: 2.6, sharpe: 0.4, trades: 6, open: 1 },
  mean_reversion_trader: { ret: -2.4, win: 0.42, dd: 9.1, sharpe: 0.1, trades: 24, open: 2 },
  risk_manager: { ret: -4.7, win: 0.4, dd: 5.5, sharpe: -0.2, trades: 12, open: 1 },
  devils_advocate: { ret: -8.3, win: 0.36, dd: 13.8, sharpe: -0.6, trades: 16, open: 1 },
};

async function clean() {
  // Remove human PM demo agent (cascades its portfolio/decisions).
  await prisma.paperAgent.deleteMany({ where: { slug: "human_demo-use" } });
  // Session-scoped arena rows for the seed date.
  await prisma.arenaBattle.deleteMany({ where: { sessionDate: SEED_DATE } });
  await prisma.agentDecision.deleteMany({ where: { sessionDate: SEED_DATE } });
  await prisma.cioRecommendation.deleteMany({ where: { sessionDate: SEED_DATE } });
  await prisma.agentRanking.deleteMany({ where: { sessionDate: SEED_DATE } });
  await prisma.agentPerformanceDaily.deleteMany({ where: { sessionDate: SEED_DATE } });
  await prisma.portfolioSnapshot.deleteMany({ where: { sessionDate: { gte: dateAt(8) } } });
  await prisma.hallOfFameEntry.deleteMany({ where: { metadataJson: { path: ["seedTag"], equals: SEED_TAG } } });
  await prisma.sessionReplayBundle.deleteMany({ where: { sessionDate: { gte: dateAt(8) } } });
  await prisma.promptExperiment.deleteMany({ where: { configJson: { path: ["seedTag"], equals: SEED_TAG } } });
  // Open positions belonging to seeded AI agents.
  const agents = await prisma.paperAgent.findMany({ where: { slug: { in: AI_SLUGS } }, include: { portfolio: true } });
  const pfIds = agents.map((a) => a.portfolio?.id).filter(Boolean) as string[];
  if (pfIds.length) {
    await prisma.paperPosition.deleteMany({ where: { portfolioId: { in: pfIds } } });
  }
}

async function main() {
  assertLocalDb();
  if (process.argv.includes("--clean")) {
    await clean();
    console.log("[DEV_ARENA_SEED] cleaned.");
    return;
  }

  await clean(); // idempotent reset
  await seedPaperAgents(); // agents + portfolios (upsert)

  const agents = await prisma.paperAgent.findMany({
    where: { slug: { in: AI_SLUGS } },
    include: { portfolio: true },
  });
  const bySlug = new Map(agents.map((a) => [a.slug, a]));

  // ── Portfolio snapshots (6 days → sparkline), performance, rankings ──
  const ranked = [...AI_SLUGS].sort((a, b) => PROFILES[b].ret - PROFILES[a].ret);
  for (const slug of AI_SLUGS) {
    const agent = bySlug.get(slug)!;
    const pf = agent.portfolio!;
    const p = PROFILES[slug];
    const nav = Math.round(CAP * (1 + p.ret / 100));
    const invested = Math.round(nav * Math.min(0.6, 0.15 * p.open));
    const cash = nav - invested;
    const realized = Math.round((CAP * p.ret) / 100 * 0.55);
    const unrealized = Math.round((CAP * p.ret) / 100) - realized;

    for (let d = 5; d >= 0; d--) {
      const frac = (5 - d) / 5;
      const navD = Math.round(CAP * (1 + (p.ret / 100) * frac));
      await prisma.portfolioSnapshot.upsert({
        where: { portfolioId_sessionDate: { portfolioId: pf.id, sessionDate: dateAt(d) } },
        create: {
          portfolioId: pf.id, sessionDate: dateAt(d), navVnd: BigInt(navD),
          cashVnd: BigInt(d === 0 ? cash : Math.round(navD * 0.6)),
          exposurePct: d === 0 ? (invested / nav) * 100 : 40,
          sectorExposureJson: { Tech: 22, Financials: 18, Materials: 12 },
          holdingsJson: [],
        },
        update: { navVnd: BigInt(navD) },
      });
    }

    await prisma.agentPerformanceDaily.upsert({
      where: { agentId_sessionDate: { agentId: agent.id, sessionDate: SEED_DATE } },
      create: {
        agentId: agent.id, sessionDate: SEED_DATE, navVnd: BigInt(nav),
        totalReturnPct: p.ret, realizedPnlVnd: BigInt(realized), unrealizedPnlVnd: BigInt(unrealized),
        winRate: p.win, maxDrawdownPct: p.dd, sharpeLike: p.sharpe, tradeCount: p.trades,
        openPositions: p.open, metricsJson: { seedTag: SEED_TAG },
      },
      update: { navVnd: BigInt(nav), totalReturnPct: p.ret, metricsJson: { seedTag: SEED_TAG } },
    });

    const rank = ranked.indexOf(slug) + 1;
    await prisma.agentRanking.upsert({
      where: { sessionDate_agentId: { sessionDate: SEED_DATE, agentId: agent.id } },
      create: {
        sessionDate: SEED_DATE, agentId: agent.id, rank, rankChange: rank <= 3 ? 1 : rank >= 7 ? -1 : 0,
        compositeScore: 100 - rank * 7, scoreBreakdown: { seedTag: SEED_TAG, return: p.ret, sharpe: p.sharpe },
      },
      update: { rank, compositeScore: 100 - rank * 7 },
    });
  }

  // ── Open positions (unrealized) + a couple realized closed trades ──
  const posSpecs = [
    { slug: "aggressive_investor", symbol: "FPT", entry: 95, stop: 88, tp: 112, qty: 1200 },
    { slug: "aggressive_investor", symbol: "MWG", entry: 55, stop: 51, tp: 66, qty: 1800 },
    { slug: "momentum_investor", symbol: "FPT", entry: 96.5, stop: 90, tp: 115, qty: 900 },
    { slug: "trend_follower", symbol: "VCB", entry: 88, stop: 83, tp: 100, qty: 700 },
    { slug: "swing_trader", symbol: "HPG", entry: 27.5, stop: 25.5, tp: 31, qty: 3000 },
    { slug: "value_investor", symbol: "SSI", entry: 34, stop: 31, tp: 40, qty: 2000 },
  ];
  for (const s of posSpecs) {
    const pf = bySlug.get(s.slug)!.portfolio!;
    const risk = Math.round((s.entry - s.stop) * 1000 * s.qty);
    await prisma.paperPosition.create({
      data: {
        portfolioId: pf.id, symbol: s.symbol, quantity: s.qty, avgEntryKvnd: s.entry,
        stopLossKvnd: s.stop, takeProfitKvnd: s.tp, riskAmountVnd: BigInt(risk),
        status: "OPEN", openedAt: dateAt(4),
      },
    });
  }
  // Realized win + loss examples (closed positions with trades).
  for (const s of [
    { slug: "momentum_investor", symbol: "MWG", entry: 50, exit: 58, qty: 1000, reason: "TAKE_PROFIT_HIT" as const, r: 2.1 },
    { slug: "risk_manager", symbol: "SSI", entry: 36, exit: 33, qty: 1500, reason: "STOP_LOSS_HIT" as const, r: -1 },
  ]) {
    const pf = bySlug.get(s.slug)!.portfolio!;
    const pos = await prisma.paperPosition.create({
      data: {
        portfolioId: pf.id, symbol: s.symbol, quantity: s.qty, avgEntryKvnd: s.entry,
        stopLossKvnd: s.entry * 0.94, takeProfitKvnd: s.entry * 1.16, riskAmountVnd: BigInt(Math.round(s.entry * 0.06 * 1000 * s.qty)),
        status: "CLOSED", openedAt: dateAt(6), closedAt: dateAt(1),
      },
    });
    await prisma.paperTrade.create({
      data: {
        positionId: pos.id, exitReason: s.reason, quantity: s.qty, entryKvnd: s.entry, exitKvnd: s.exit,
        realizedPnlVnd: BigInt(Math.round((s.exit - s.entry) * 1000 * s.qty)), rMultiple: s.r,
        holdingDays: 5, closedSessionDate: dateAt(1),
      },
    });
  }

  // ── Decisions today: strong consensus (FPT) + split (HPG) ──
  // FPT: 7 BUY, 1 HOLD, 1 REDUCE → strong BUY consensus.
  // HPG: 3 BUY, 3 HOLD, 3 SELL → split.
  const decisionIdByKey = new Map<string, string>();
  const plan: { symbol: string; actions: Record<string, string> }[] = [
    {
      symbol: "FPT",
      actions: {
        aggressive_investor: "BUY", momentum_investor: "BUY", trend_follower: "BUY", swing_trader: "BUY",
        value_investor: "BUY", safe_investor: "HOLD", mean_reversion_trader: "BUY", risk_manager: "BUY",
        devils_advocate: "REDUCE",
      },
    },
    {
      symbol: "HPG",
      actions: {
        aggressive_investor: "BUY", momentum_investor: "BUY", trend_follower: "HOLD", swing_trader: "BUY",
        value_investor: "HOLD", safe_investor: "HOLD", mean_reversion_trader: "SELL", risk_manager: "SELL",
        devils_advocate: "SELL",
      },
    },
  ];
  const reasonFor = (action: string, symbol: string) =>
    action === "BUY" ? `Momentum and structure favour ${symbol}; entry above the pivot with room to the stop.`
      : action === "SELL" ? `${symbol} is extended into resistance; risk/reward no longer supports new exposure.`
      : action === "REDUCE" ? `Trimming ${symbol} into strength to lock partial gains and cut open risk.`
      : `Holding ${symbol}; conditions are mixed and conviction is below the entry threshold.`;

  for (const d of plan) {
    for (const slug of AI_SLUGS) {
      const agent = bySlug.get(slug)!;
      const action = d.actions[slug];
      const confidence = action === "HOLD" ? 0.45 + Math.random() * 0.1 : 0.6 + Math.random() * 0.35;
      const reasoning = reasonFor(action, d.symbol);
      const decision = await prisma.agentDecision.create({
        data: {
          agentId: agent.id, agentVersion: "1.0.0", sessionDate: SEED_DATE, symbol: d.symbol,
          action: action as never, confidence: Math.round(confidence * 100) / 100, validationStatus: "VALID",
          reasoningSummary: reasoning,
          output: { create: { payload: { symbol: d.symbol, action, confidence, reasoning, seedTag: SEED_TAG } } },
        },
      });
      decisionIdByKey.set(`${d.symbol}:${slug}`, decision.id);
    }
  }

  // ── CIO recommendations for both battle symbols ──
  for (const d of plan) {
    const votes = Object.values(d.actions);
    const buy = votes.filter((v) => v === "BUY").length;
    const finalAction = buy >= 6 ? "BUY" : buy >= 4 ? "HOLD" : "SELL";
    const dissent = AI_SLUGS.filter((s) => {
      const a = d.actions[s];
      return finalAction === "BUY" ? a !== "BUY" : a === "BUY";
    });
    await prisma.cioRecommendation.upsert({
      where: { sessionDate_symbol: { sessionDate: SEED_DATE, symbol: d.symbol } },
      create: {
        sessionDate: SEED_DATE, symbol: d.symbol,
        payload: {
          recommendation_id: randomUUID(), session_date: "2026-07-03", symbol: d.symbol,
          final_action: finalAction, confidence: finalAction === "BUY" ? 0.78 : 0.55,
          consensus_score: buy / votes.length, entry_price: null, stop_loss: null, take_profit: null,
          suggested_position_size_vnd: finalAction === "BUY" ? 60_000_000 : null,
          reasoning: finalAction === "BUY"
            ? `The league broadly favours ${d.symbol}: ${buy} of ${votes.length} agents want exposure.`
            : `The league is split on ${d.symbol}; the CIO holds pending confirmation.`,
          supporting_agents: AI_SLUGS.filter((s) => d.actions[s] === (finalAction === "BUY" ? "BUY" : d.actions[s]))
            .slice(0, 4).map((s) => ({ agent_id: s, action: d.actions[s], weight: 0.2, confidence: 0.7 })),
          dissenting_agents: dissent.slice(0, 3).map((s) => ({ agent_id: s, action: d.actions[s], reason: reasonFor(d.actions[s], d.symbol) })),
          risks: [`${d.symbol} liquidity thins into the close`, "Regime is only WARNING — size down"],
          agent_weights_used: Object.fromEntries(AI_SLUGS.map((s) => [s, 0.11])),
          metadata: { cio_version: "1.0.0", regime: "WARNING", seedTag: SEED_TAG },
        },
      },
      update: {},
    });
  }

  // ── Regime + market context (NOW zone) ──
  await prisma.marketRegimeSnapshot.upsert({
    where: { sessionDate: SEED_DATE },
    create: {
      sessionDate: SEED_DATE, gate1Level: "WARNING", confidence: 0.68,
      dimensionsJson: {
        trendRegime: "WeakBull", volatilityRegime: "LowVol", liquidityRegime: "HighLiquidity",
        breadthRegime: "RiskOn", structureRegime: "Normal", eventRegime: "Normal",
      },
    },
    update: { gate1Level: "WARNING", confidence: 0.68 },
  });
  await prisma.marketContextDaily.upsert({
    where: { sessionDate: SEED_DATE },
    create: { sessionDate: SEED_DATE, vnindexClose: 1298.4, vnindexMa20: 1275.1, vnindexMa50: 1260.0, gate1Level: "WARNING" },
    update: { vnindexClose: 1298.4, vnindexMa20: 1275.1, gate1Level: "WARNING" },
  });

  // ── Battles (CONFLICT) ──
  for (const [i, d] of plan.entries()) {
    const votes = Object.values(d.actions);
    const buy = votes.filter((v) => v === "BUY").length;
    const bench = i === 0 ? 3.4 : -1.2;
    const battle = await prisma.arenaBattle.create({
      data: {
        sessionDate: SEED_DATE, symbol: d.symbol, status: "RESOLVED", benchmarkReturn5dPct: bench, resolvedAt: SEED_DATE,
      },
    });
    for (const slug of AI_SLUGS) {
      const decisionId = decisionIdByKey.get(`${d.symbol}:${slug}`)!;
      const action = d.actions[slug];
      const bd = await prisma.arenaBattleDecision.create({
        data: {
          battleId: battle.id, decisionId, agentId: bySlug.get(slug)!.id, action: action as never,
          confidence: 0.7, reasoning: reasonFor(action, d.symbol),
        },
      });
      const correct = (bench > 0 && action === "BUY") || (bench < 0 && (action === "SELL" || action === "HOLD"));
      await prisma.arenaBattleOutcome.create({
        data: {
          battleId: battle.id, battleDecisionId: bd.id, agentId: bySlug.get(slug)!.id,
          verdict: bench > 0 ? (action === "BUY" ? "CORRECT_BUY" : "WRONG_AVOID") : (action === "BUY" ? "WRONG_BUY" : "CORRECT_AVOID"),
          rMultiple: correct ? 1.4 : -0.8, forwardReturn5dPct: bench, resolvedAt: SEED_DATE,
        },
      });
    }
    void buy;
  }

  // ── LEARNING: Hall of Fame, experiments, timeline ──
  const champ = bySlug.get("aggressive_investor")!;
  const hof: { type: string; agentId: string; symbol: string; value: number }[] = [
    { type: "HIGHEST_R_MULTIPLE", agentId: champ.id, symbol: "MWG", value: 4.2 },
    { type: "BEST_MONTHLY_RETURN", agentId: champ.id, symbol: "FPT", value: 18.4 },
    { type: "MOST_ACCURATE_AGENT", agentId: bySlug.get("trend_follower")!.id, symbol: "—", value: 0.71 },
    { type: "LONGEST_WIN_STREAK", agentId: bySlug.get("momentum_investor")!.id, symbol: "—", value: 7 },
    { type: "BEST_RECOVERY", agentId: bySlug.get("swing_trader")!.id, symbol: "HPG", value: 12.6 },
  ];
  for (const h of hof) {
    await prisma.hallOfFameEntry.create({
      data: {
        achievementType: h.type as never, agentId: h.agentId, sessionDate: SEED_DATE, symbol: h.symbol,
        value: h.value, metadataJson: { seedTag: SEED_TAG },
      },
    });
  }

  // Prompt experiment (needs a prompt version for its arm).
  const pv = await prisma.promptVersion.upsert({
    where: { agentId_versionLabel: { agentId: champ.id, versionLabel: "v2-demo" } },
    create: {
      agentId: champ.id, versionLabel: "v2-demo", promptHash: "demohash2", promptText: "Demo challenger prompt.",
      status: "CHALLENGER", effectiveFrom: SEED_DATE, temperature: 0.4,
    },
    update: {},
  });
  const exp = await prisma.promptExperiment.create({
    data: {
      name: "Momentum prompt A/B (demo)", type: "PROMPT_AB", status: "COMPLETED", startedAt: dateAt(6), finishedAt: dateAt(1),
      configJson: { seedTag: SEED_TAG },
      arms: {
        create: [
          { armLabel: "control", promptVersionId: pv.id, isControl: true, metricsJson: { winRate: 0.52, return: 6.1 } },
          { armLabel: "challenger", promptVersionId: pv.id, isControl: false, metricsJson: { winRate: 0.61, return: 12.1 } },
        ],
      },
    },
  });
  void exp;

  // Timeline (session replay bundles).
  for (let d = 6; d >= 0; d--) {
    await prisma.sessionReplayBundle.upsert({
      where: { sessionDate: dateAt(d) },
      create: {
        sessionDate: dateAt(d),
        bundleJson: {
          seedTag: SEED_TAG,
          decisions: new Array(9 + ((6 - d) % 4)).fill(0).map((_, i) => ({ i })),
          battles: new Array(1 + ((6 - d) % 2)).fill(0).map((_, i) => ({ i })),
        },
      },
      update: {},
    });
  }

  // ── DECISION: Human PM review items (one accepts AI consensus, one overrides) ──
  const human = await prisma.paperAgent.upsert({
    where: { slug: "human_demo-use" },
    create: {
      slug: "human_demo-use", displayName: "Human PM", style: "Discretionary", agentClass: "HUMAN", userId: "demo-user",
      portfolio: { create: { initialCapitalVnd: BigInt(CAP), cashVnd: BigInt(CAP) } },
    },
    update: {},
  });
  const humanCalls = [
    { symbol: "FPT", action: "BUY", reasoning: "Accepted the AI consensus — league strongly favours FPT and the setup is clean." },
    { symbol: "HPG", action: "HOLD", reasoning: "Override: agents split BUY/SELL on HPG; standing aside until the range resolves." },
  ];
  for (const c of humanCalls) {
    await prisma.agentDecision.create({
      data: {
        agentId: human.id, agentVersion: "human", sessionDate: SEED_DATE, symbol: c.symbol,
        action: c.action as never, confidence: 0.7, validationStatus: "VALID", reasoningSummary: c.reasoning,
        output: { create: { payload: { symbol: c.symbol, action: c.action, reasoning: c.reasoning, seedTag: SEED_TAG } } },
      },
    });
  }

  const counts = {
    agents: agents.length,
    performance: await prisma.agentPerformanceDaily.count({ where: { sessionDate: SEED_DATE } }),
    positionsOpen: await prisma.paperPosition.count({ where: { status: "OPEN" } }),
    decisions: await prisma.agentDecision.count({ where: { sessionDate: SEED_DATE } }),
    battles: await prisma.arenaBattle.count({ where: { sessionDate: SEED_DATE } }),
    cio: await prisma.cioRecommendation.count({ where: { sessionDate: SEED_DATE } }),
    hof: await prisma.hallOfFameEntry.count(),
    experiments: await prisma.promptExperiment.count(),
    timeline: await prisma.sessionReplayBundle.count(),
    humanCalls: humanCalls.length,
  };
  console.log(`[${SEED_TAG}] seeded for ${SEED_DATE.toISOString().slice(0, 10)}:`, counts);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
