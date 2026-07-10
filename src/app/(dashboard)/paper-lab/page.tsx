import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { queryHallOfFame } from "@/lib/lab/hall-of-fame/detect-achievements";
import { loadPaperLabPageDto } from "@/lib/paper-lab/load-paper-lab-page";
import { ArenaWorkspace, type ArenaLearning } from "@/components/paper-lab/ArenaWorkspace";

export const metadata: Metadata = {
  title: "Arena | TradeLog",
  description:
    "Arena — pressure-test strategies in simulation. Agents compete on the same market data; every portfolio, order and result is simulated. No real capital.",
};

export const dynamic = "force-dynamic";

/** Learning-zone summaries — the same queries the deep-link routes use, guarded
 *  so the workspace still renders when those tables are empty or absent. */
async function loadLearning(): Promise<ArenaLearning> {
  const [humanDecisions, battles, achievements, experiments, timeline] = await Promise.all([
    prisma.agentDecision
      .findMany({
        where: { agent: { agentClass: "HUMAN" } },
        orderBy: { createdAt: "desc" },
        take: 6,
      })
      .catch(() => [] as { id: string; symbol: string; action: string; reasoningSummary: string | null }[]),
    prisma.arenaBattle
      .findMany({ orderBy: { sessionDate: "desc" }, take: 20, include: { battleDecisions: true } })
      .catch(() => [] as { id: string; sessionDate: Date; symbol: string; status: string; battleDecisions: unknown[]; benchmarkReturn5dPct: number | null }[]),
    queryHallOfFame(prisma, { limit: 15 }).catch(() => []),
    prisma.promptExperiment
      .findMany({ orderBy: { startedAt: "desc" }, take: 12, include: { arms: true } })
      .catch(() => [] as { id: string; name: string; type: string; status: string; arms: unknown[]; startedAt: Date }[]),
    prisma.sessionReplayBundle
      .findMany({ orderBy: { sessionDate: "desc" }, take: 12 })
      .catch(() => [] as { id: string; sessionDate: Date; bundleJson: unknown }[]),
  ]);

  return {
    humanCalls: humanDecisions.map((d) => {
      const reasoning = d.reasoningSummary ?? "";
      return {
        id: d.id,
        symbol: d.symbol,
        action: d.action,
        reasoning,
        kind: /override|pass|stand/i.test(reasoning) ? ("override" as const) : ("accepted" as const),
      };
    }),
    battles: battles.map((b) => ({
      id: b.id,
      session: b.sessionDate.toISOString().slice(0, 10),
      symbol: b.symbol,
      status: b.status,
      agents: b.battleDecisions.length,
      bench: b.benchmarkReturn5dPct != null ? `${b.benchmarkReturn5dPct.toFixed(1)}%` : "—",
    })),
    achievements: achievements.map((e) => ({
      id: e.id,
      type: e.achievementType.replace(/_/g, " "),
      agent: e.agent?.displayName ?? "—",
      session: e.sessionDate?.toISOString().slice(0, 10) ?? "—",
      symbol: e.symbol ?? "—",
      value: e.value,
    })),
    experiments: experiments.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      status: e.status,
      arms: e.arms.length,
      started: e.startedAt.toISOString().slice(0, 10),
    })),
    timeline: timeline.map((b) => {
      const json = b.bundleJson as { decisions?: unknown[]; battles?: unknown[] } | null;
      return {
        id: b.id,
        session: b.sessionDate.toISOString().slice(0, 10),
        decisions: json?.decisions?.length ?? 0,
        battles: json?.battles?.length ?? 0,
      };
    }),
  };
}

export default async function PaperLabPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [data, learning, sp] = await Promise.all([
    loadPaperLabPageDto(),
    loadLearning(),
    searchParams,
  ]);
  const focus = typeof sp?.focus === "string" ? sp.focus : null;

  return <ArenaWorkspace data={data} learning={learning} focus={focus} />;
}
