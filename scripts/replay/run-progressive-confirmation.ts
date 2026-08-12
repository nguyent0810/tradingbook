/**
 * READ-ONLY: when, after a recovery attempt begins, does market internal
 * evidence start to distinguish recoveries that hold from ones that fail?
 *
 * Reuses everything already built. New here is only the episode state machine
 * (`recovery-episode.ts`) and the checkpoint logic below — the internals series,
 * breadth, volume breadth, dispersion and leader flags are read from artifacts
 * produced by earlier runs rather than recomputed.
 *
 * Two disciplines the previous phase failed:
 *   - a checkpoint is evaluated ONLY if the episode had not already resolved
 *     before it, so a fast failure cannot silently leave the sample
 *   - features are progression DELTAS from T0, not levels, because the prior
 *     phase showed levels at T0 are identical between the two classes
 *
 *   npx tsx scripts/replay/run-progressive-confirmation.ts --out docs/trading/replay/progressive
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { segmentEpisodes, type SegmentParams } from "../../src/lib/research/recovery-episode";
import { GATE2_RANGE_DAYS, GATE2_BREAKOUT_RECENCY_BARS } from "../../src/lib/scanner/gate2/constants";
import { FRESH_RECLAIM_SESSIONS } from "../../src/lib/research/market-state";
import { rollingMean } from "../../src/lib/research/leadership-features";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

type Internal = {
  sessionDate: string;
  indexClose: number;
  indexMa50: number | null;
  n: number;
  pctAboveMa10: number | null;
  pctAboveMa20: number | null;
  pctAboveMa50: number | null;
  pctUp20d: number | null;
  advDeclRatio: number | null;
  newHighs: number;
  newLows: number;
  nWithYear: number;
  pctVolumeExpanding: number | null;
  upVolumeShare: number | null;
  r20Median: number | null;
  r20P90: number | null;
  r20Iqr: number | null;
};

type Obs = {
  sessionDate: string;
  symbol: string;
  gate1Level: string;
  aboveMa10: boolean;
  earlyRsImproving: boolean;
  rsSlopeTopQuintile?: boolean;
  urPresent: boolean;
  freshMa10Reclaim: boolean;
};

const isLeader = (o: Obs) =>
  Boolean(o.earlyRsImproving && o.rsSlopeTopQuintile && (o.urPresent || o.freshMa10Reclaim) && o.aboveMa10);

/** Sessions after T0 at which evidence is snapshotted. Declared up front. */
const CHECKPOINTS = [0, 1, 2, 3, 5, 8, 10] as const;

/** Universe floor below which breadth is meaningless — see the previous phase. */
const MIN_UNIVERSE = 100;

function main(): void {
  const outDir = arg("out") ?? "docs/trading/replay/progressive";

  const internals: Internal[] = readFileSync("docs/trading/replay/recovery/internals.ndjson", "utf8")
    .trim().split("\n").map((l) => JSON.parse(l) as Internal)
    .filter((r) => r.n >= MIN_UNIVERSE);
  const obsRaw: Obs[] = readFileSync("docs/trading/replay/leadership/observations.ndjson", "utf8")
    .trim().split("\n").map((l) => JSON.parse(l) as Obs);

  console.error(`internals: ${internals.length} usable sessions (first ${internals[0]!.sessionDate})`);

  // Leader counts and per-symbol leader membership, by session.
  const leadersByDate = new Map<string, Set<string>>();
  const gate1ByDate = new Map<string, string>();
  const aboveMa10ByDate = new Map<string, Map<string, boolean>>();
  for (const o of obsRaw) {
    if (!gate1ByDate.has(o.sessionDate)) gate1ByDate.set(o.sessionDate, o.gate1Level);
    let m = aboveMa10ByDate.get(o.sessionDate);
    if (!m) { m = new Map(); aboveMa10ByDate.set(o.sessionDate, m); }
    m.set(o.symbol, o.aboveMa10);
    if (isLeader(o)) {
      let s = leadersByDate.get(o.sessionDate);
      if (!s) { s = new Set(); leadersByDate.set(o.sessionDate, s); }
      s.add(o.symbol);
    }
  }

  const closes = internals.map((r) => r.indexClose);
  const ma10 = rollingMean(closes, 10);
  const ma20 = rollingMean(closes, 20);
  const ma50 = rollingMean(closes, 50);

  // Defaults are repo constants. Overridable ONLY so the same analysis can be
  // re-run under alternative label definitions for the sensitivity table — not
  // so a favourable one can be selected.
  const params: SegmentParams = {
    newLowLookback: Number(arg("new-low") ?? GATE2_RANGE_DAYS),
    stabilizationSessions: Number(arg("stab") ?? FRESH_RECLAIM_SESSIONS),
    holdSessions: Number(arg("hold") ?? GATE2_BREAKOUT_RECENCY_BARS),
    horizonSessions: Number(arg("horizon") ?? 40),
  };
  console.error(`params: ${JSON.stringify(params)}`);
  const episodes = segmentEpisodes(closes, params);
  console.error(`episodes: ${episodes.length}`);

  const rows = episodes.map((ep) => {
    const t0 = internals[ep.t0]!;
    const era = t0.sessionDate < "2015-01-01" ? "pre-2015"
      : t0.sessionDate < "2022-01-01" ? "2015-2021" : "2022-2026";

    const snap = (i: number) => {
      const r = internals[i];
      if (!r) return null;
      const leaders = leadersByDate.get(r.sessionDate) ?? new Set<string>();
      return {
        sessionDate: r.sessionDate,
        pctAboveMa10: r.pctAboveMa10, pctAboveMa20: r.pctAboveMa20, pctAboveMa50: r.pctAboveMa50,
        newLowRate: r.nWithYear > 0 ? (r.newLows / r.nWithYear) * 100 : null,
        newHighRate: r.nWithYear > 0 ? (r.newHighs / r.nWithYear) * 100 : null,
        advDeclRatio: r.advDeclRatio,
        pctVolumeExpanding: r.pctVolumeExpanding,
        upVolumeShare: r.upVolumeShare,
        r20Median: r.r20Median, r20Iqr: r.r20Iqr,
        leaderCount: leaders.size,
        // Distance to structure, in percent of the index.
        distToMa10: ma10[i] != null ? ((r.indexClose - ma10[i]!) / ma10[i]!) * 100 : null,
        distToMa20: ma20[i] != null ? ((r.indexClose - ma20[i]!) / ma20[i]!) * 100 : null,
        distToMa50: ma50[i] != null ? ((r.indexClose - ma50[i]!) / ma50[i]!) * 100 : null,
        recoveryProgress: ((r.indexClose - ep.episodeLow) / ep.episodeLow) * 100,
        gate1: gate1ByDate.get(r.sessionDate) ?? null,
      };
    };

    const base = snap(ep.t0)!;
    const checkpoints: Record<string, unknown> = {};
    for (const k of CHECKPOINTS) {
      // Evaluate a checkpoint ONLY if the episode had not resolved before it.
      // An episode that failed at T+2 must never appear in the T+5 sample.
      const alive = ep.resolvedAt == null || ep.resolvedAt > k;
      const s = alive ? snap(ep.t0 + k) : null;
      checkpoints[`T${k}`] = s
        ? {
            alive: true,
            ...s,
            // Progression deltas — the hypothesis is about trajectory, not level.
            dMa10: s.pctAboveMa10 != null && base.pctAboveMa10 != null ? s.pctAboveMa10 - base.pctAboveMa10 : null,
            dMa20: s.pctAboveMa20 != null && base.pctAboveMa20 != null ? s.pctAboveMa20 - base.pctAboveMa20 : null,
            dMa50: s.pctAboveMa50 != null && base.pctAboveMa50 != null ? s.pctAboveMa50 - base.pctAboveMa50 : null,
            dNewLowRate: s.newLowRate != null && base.newLowRate != null ? s.newLowRate - base.newLowRate : null,
            dNewHighRate: s.newHighRate != null && base.newHighRate != null ? s.newHighRate - base.newHighRate : null,
            dUpVolumeShare: s.upVolumeShare != null && base.upVolumeShare != null ? s.upVolumeShare - base.upVolumeShare : null,
            dVolumeExpanding: s.pctVolumeExpanding != null && base.pctVolumeExpanding != null ? s.pctVolumeExpanding - base.pctVolumeExpanding : null,
            dLeaderCount: s.leaderCount - base.leaderCount,
            dR20Median: s.r20Median != null && base.r20Median != null ? s.r20Median - base.r20Median : null,
            dR20Iqr: s.r20Iqr != null && base.r20Iqr != null ? s.r20Iqr - base.r20Iqr : null,
            // Leader survival measured only over leaders flagged AT T0, so it
            // cannot drift into counting names flagged later.
            leaderSurvival: (() => {
              const flagged = leadersByDate.get(base.sessionDate);
              if (!flagged || flagged.size === 0) return null;
              const later = aboveMa10ByDate.get(s.sessionDate);
              if (!later) return null;
              let seen = 0, held = 0;
              for (const sym of flagged) {
                const v = later.get(sym);
                if (v === undefined) continue;
                seen++;
                if (v) held++;
              }
              return seen > 0 ? (held / seen) * 100 : null;
            })(),
          }
        : { alive: false };
    }

    // First session at or after T0 where the OLD Gate 1 said PASS.
    let gate1PassLag: number | null = null;
    for (let k = 0; k <= 120 && ep.t0 + k < internals.length; k++) {
      if (gate1ByDate.get(internals[ep.t0 + k]!.sessionDate) === "PASS") { gate1PassLag = k; break; }
    }

    return {
      // Identity is the DECLINE, not the attempt: it is invariant to every
      // resolution parameter, so the same episode can be tracked across the
      // whole sensitivity grid and T0-freezing can be asserted.
      episodeId: internals[ep.downtrendStart]!.sessionDate,
      t0Date: t0.sessionDate, era,
      downtrendStartDate: internals[ep.downtrendStart]!.sessionDate,
      declineSessions: ep.t0 - ep.downtrendStart,
      outcome: ep.outcome, resolvedAt: ep.resolvedAt,
      drawdownAtT0: ep.drawdownAtT0,
      indexAtT0: t0.indexClose, episodeLow: ep.episodeLow,
      gate1PassLag,
      indexAtGate1Pass: gate1PassLag != null ? internals[ep.t0 + gate1PassLag]!.indexClose : null,
      base, checkpoints,
    };
  });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/episodes.json`, JSON.stringify(rows, null, 1), "utf8");
  console.error(`wrote ${rows.length} episodes to ${outDir}/episodes.json`);

  const counts: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    counts[r.era] ??= {};
    counts[r.era]![r.outcome] = (counts[r.era]![r.outcome] ?? 0) + 1;
  }
  console.error(JSON.stringify(counts, null, 1));
}

main();
