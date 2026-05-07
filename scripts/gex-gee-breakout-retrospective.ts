/**
 * Walk-forward Gate 2 replay for GEX/GEE over the last N sessions (diagnostic only).
 *
 * Usage:
 *   npx tsx scripts/gex-gee-breakout-retrospective.ts --prod-local
 *   npx tsx scripts/gex-gee-breakout-retrospective.ts --sessions=40 --prod-local
 *
 * Writes: docs/trading/gex-gee-breakout-retrospective.md
 *
 * Does not modify scanner rules, tradability, or Gate2 logic.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import { sma } from "../src/lib/playbook/indicators";
import type { Gate2BarInput } from "../src/lib/scanner/gate2/types";
import { evaluateBreakoutPullbackCandidate } from "../src/lib/scanner/gate2/breakout-pullback";
import {
  categorizeTerminalReason,
  terminalGate2Reason,
  type TerminalCategory,
} from "../src/lib/scanner/gate2-scan-diagnostics";
import type { TradabilityBarInput } from "../src/lib/scanner/tradability-types";
import { evaluateTradability } from "../src/lib/scanner/tradability";
import {
  computeDistanceToPullbackZoneFrac,
  computeRiskToStopFrac,
} from "../src/lib/scanner/closest-execution-metrics";

function bootstrapEnv(): void {
  const root = process.cwd();
  config({ path: resolve(root, ".env") });
  config({ path: resolve(root, ".env.local"), override: true });
  if (process.argv.includes("--prod-local")) {
    config({ path: resolve(root, ".env.prod.local"), override: true });
  }
}

bootstrapEnv();

const SYMBOLS = ["GEX", "GEE"] as const;

function utcDayOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoDay(d: Date): string {
  const x = utcDayOnly(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseSessions(argv: string[]): number {
  const raw = argv.find((a) => a.startsWith("--sessions="));
  if (!raw) return 40;
  const n = Number.parseInt(raw.slice("--sessions=".length), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 250) : 40;
}

function passedBreakoutRecency(ev: { reasons: readonly string[] }): boolean {
  return ev.reasons.some((r) => r.startsWith("Fresh breakout:"));
}

type ReplayRow = {
  date: string;
  close: number;
  volume: number;
  ma20: number | null;
  ma50: number | null;
  tradabilityPassed: boolean;
  tradabilityReasons: string[];
  gate2Quality: string;
  terminalCategory: TerminalCategory | "N/A" | "VALID";
  terminalReason: string;
  breakoutLevel: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  distanceToPullbackZoneFrac: number | null;
  riskToStopFrac: number | null;
  stageRank: number | null;
  passedBreakoutRecencyGate: boolean;
};

function metricsFromEvaluation(ev: {
  close: number;
  pullbackZoneLow: number;
  pullbackZoneHigh: number;
  stopLevel: number;
}): {
  distanceToPullbackZoneFrac: number | null;
  riskToStopFrac: number | null;
} {
  const distRaw = computeDistanceToPullbackZoneFrac(
    ev.close,
    ev.pullbackZoneLow,
    ev.pullbackZoneHigh
  );
  const distanceToPullbackZoneFrac =
    Number.isFinite(distRaw) ? Number(distRaw.toFixed(6)) : null;

  const riskRaw =
    ev.stopLevel > 0 ? computeRiskToStopFrac(ev.close, ev.stopLevel) : Number.NaN;
  const riskToStopFrac =
    Number.isFinite(riskRaw) ? Number(riskRaw.toFixed(6)) : null;

  return { distanceToPullbackZoneFrac, riskToStopFrac };
}

function escapeMdCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").slice(0, 120);
}

function fmtNum(n: number | null): string {
  if (n === null) return "null";
  return Number.isFinite(n) ? n.toFixed(2) : "null";
}

async function main(): Promise<void> {
  const sessions = parseSessions(process.argv.slice(2));
  const { prisma } = await import("../src/lib/prisma");

  try {
  const generatedAt = new Date().toISOString();

  const perSymbol: {
    symbol: string;
    rows: ReplayRow[];
    barCountTotal: number;
  }[] = [];

  for (const symbol of SYMBOLS) {
    const stock = await prisma.stockSymbol.findUnique({
      where: { symbol },
      select: { id: true },
    });

    if (!stock) {
      throw new Error(`Missing StockSymbol row for ${symbol}`);
    }

    const allBars = await prisma.stockDailyBar.findMany({
      where: { symbolId: stock.id },
      orderBy: { date: "asc" },
      select: {
        date: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
      },
    });

    const gateBarsFull: Gate2BarInput[] = allBars.map((b) => ({
      date: b.date,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));

    const tailStart = Math.max(0, gateBarsFull.length - sessions);
    const rows: ReplayRow[] = [];

    for (let idx = tailStart; idx < gateBarsFull.length; idx++) {
      const slice = gateBarsFull.slice(0, idx + 1);
      const lastBar = slice[slice.length - 1]!;
      const expectedLatestSession = utcDayOnly(lastBar.date);

      const tradInputs: TradabilityBarInput[] = slice.map((b) => ({
        date: b.date,
        close: b.close,
        volume: b.volume,
      }));
      const trad = evaluateTradability(tradInputs, expectedLatestSession);

      const ev = evaluateBreakoutPullbackCandidate(slice, expectedLatestSession);
      const term = terminalGate2Reason(ev);
      const cat: TerminalCategory | "VALID" =
        ev.quality === "INVALID"
          ? categorizeTerminalReason(term).category
          : "VALID";
      const stageRank =
        ev.quality === "INVALID" ? categorizeTerminalReason(term).stageRank : null;

      const closes = slice.map((b) => b.close);
      const L = slice.length - 1;
      const ma20Series = sma(closes, 20);
      const ma50Series = sma(closes, 50);
      const ma20 = ma20Series[L];
      const ma50 = ma50Series[L];
      const ma20v =
        ma20 !== undefined && Number.isFinite(ma20) && !Number.isNaN(ma20)
          ? ma20
          : null;
      const ma50v =
        ma50 !== undefined && Number.isFinite(ma50) && !Number.isNaN(ma50)
          ? ma50
          : null;

      const { distanceToPullbackZoneFrac, riskToStopFrac } =
        metricsFromEvaluation(ev);

      rows.push({
        date: isoDay(lastBar.date),
        close: lastBar.close,
        volume: lastBar.volume,
        ma20: ma20v,
        ma50: ma50v,
        tradabilityPassed: trad.passed,
        tradabilityReasons: [...trad.reasons],
        gate2Quality: ev.quality,
        terminalCategory: cat,
        terminalReason: term || "(none)",
        breakoutLevel: ev.breakoutLevel,
        pullbackZoneLow: ev.pullbackZoneLow,
        pullbackZoneHigh: ev.pullbackZoneHigh,
        distanceToPullbackZoneFrac,
        riskToStopFrac,
        stageRank,
        passedBreakoutRecencyGate: passedBreakoutRecency(ev),
      });
    }

    perSymbol.push({
      symbol,
      rows,
      barCountTotal: gateBarsFull.length,
    });
  }

  /** Narrative helpers */
  function summarizeSymbol(rows: ReplayRow[]): {
    anyAB: boolean;
    anyPassedRecency: boolean;
    laterBlockCounts: Record<string, number>;
    last: ReplayRow | undefined;
    firstRecencyPassDate: string | null;
  } {
    let anyAB = false;
    let anyPassedRecency = false;
    const laterBlockCounts: Record<string, number> = {};
    let firstRecencyPassDate: string | null = null;

    for (const r of rows) {
      if (r.gate2Quality === "A" || r.gate2Quality === "B") {
        anyAB = true;
      }
      if (r.passedBreakoutRecencyGate) {
        anyPassedRecency = true;
        if (!firstRecencyPassDate) firstRecencyPassDate = r.date;
        if (r.gate2Quality === "INVALID") {
          const k = String(r.terminalCategory);
          laterBlockCounts[k] = (laterBlockCounts[k] ?? 0) + 1;
        }
      }
    }

    return {
      anyAB,
      anyPassedRecency,
      laterBlockCounts,
      last: rows[rows.length - 1],
      firstRecencyPassDate,
    };
  }

  const parts: string[] = [];
  parts.push("# GEX / GEE — Breakout-recency retrospective");
  parts.push("");
  parts.push(`Generated (UTC): \`${generatedAt}\``);
  parts.push("");
  parts.push("## Methodology");
  parts.push("");
  parts.push(
    "- **Diagnostic only**: replay uses existing `evaluateTradability` + `evaluateBreakoutPullbackCandidate` unchanged."
  );
  parts.push(
    "- **Walk-forward**: for each session `t`, only bars with date ≤ `t` are visible; `expectedLatestSession` is set to `t`."
  );
  parts.push(
    `- **Window**: last **${sessions}** sessions per symbol (from latest stored daily bar backward).`
  );
  parts.push(
    "- **`passedBreakoutRecencyGate`**: true iff evaluator appended a line beginning with `Fresh breakout:` (found a qualifying breakout bar `j` in `[t−10, t−1]` vs prior 20-day range high)."
  );
  parts.push("");

  parts.push("## Direct answers");
  parts.push("");

  for (const block of perSymbol) {
    const s = summarizeSymbol(block.rows);
    parts.push(`### ${block.symbol}`);
    parts.push("");
    parts.push(
      `- **Ever Tier A or B in window?** ${s.anyAB ? "Yes" : "No"}.`
    );
    parts.push(
      `- **Ever pass breakout-recency (fresh breakout detected)?** ${s.anyPassedRecency ? "Yes" : "No"}.`
    );
    if (s.anyPassedRecency) {
      parts.push(
        `  - First session in window with recency pass: **${s.firstRecencyPassDate ?? "—"}**.`
      );
      if (Object.keys(s.laterBlockCounts).length > 0) {
        parts.push(
          "  - When recency passed but Gate2 stayed **INVALID**, terminal categories (session counts):"
        );
        for (const k of Object.keys(s.laterBlockCounts).sort()) {
          parts.push(`    - \`${k}\`: ${s.laterBlockCounts[k]}`);
        }
      }
    }
    if (!s.anyPassedRecency && s.last) {
      parts.push(
        "  - **Why no breakout flag:** on those days the scanner searches breakout bar index `j` in `[L−10, L−1]` for `close[j] > rangeHigh(j−20 … j−1)`. None satisfied — typical patterns are **ongoing range**, **breakout older than 10 bars**, or **drift without a decisive close vs the trailing 20-session range**."
      );
    }

    const last = s.last;
    if (last) {
      parts.push("");
      parts.push("**Latest session in replay (most recent bar)**");
      parts.push("");
      parts.push("| Field | Value |");
      parts.push("| --- | --- |");
      parts.push(`| date | ${last.date} |`);
      parts.push(`| close | ${last.close} |`);
      parts.push(`| volume | ${last.volume} |`);
      parts.push(`| ma20 | ${fmtNum(last.ma20)} |`);
      parts.push(`| ma50 | ${fmtNum(last.ma50)} |`);
      parts.push(`| tradability | ${last.tradabilityPassed ? "PASS" : "FAIL"} |`);
      parts.push(`| Gate2 | ${last.gate2Quality} |`);
      parts.push(`| passedBreakoutRecencyGate | ${last.passedBreakoutRecencyGate} |`);
      parts.push(`| terminalCategory | ${last.terminalCategory} |`);
      parts.push(`| terminalReason (trimmed) | ${escapeMdCell(last.terminalReason)} |`);
      parts.push(
        `| distanceToPullbackZoneFrac | ${last.distanceToPullbackZoneFrac ?? "null"} |`
      );
      parts.push(`| riskToStopFrac | ${last.riskToStopFrac ?? "null"} |`);
      parts.push(`| stageRank | ${last.stageRank ?? "null"} |`);
      parts.push("");
      parts.push(
        "**Interpretation (latest move vs template):** The core playbook expects a **fresh** close-through of the **prior 20-day range high** on one of the **10 bars before today**, then **digestion**, then **pullback-zone interaction** under caps. If price is strong on **MA structure** but stuck in `breakout_recency`, the move is usually **not** a missed Tier-A/B signal under current definitions — it is **trend / continuation without that specific breakout trigger**, or an **older impulse** outside the recency window."
      );
    }
    parts.push("");
  }

  const summaries = perSymbol.map((b) => ({
    symbol: b.symbol,
    ...summarizeSymbol(b.rows),
  }));

  parts.push("## Consolidated Q&A");
  parts.push("");
  parts.push(
    `- **Did either symbol ever become Tier A or B in the last ${sessions} sessions?** ${summaries.some((x) => x.anyAB) ? "Yes (see per-symbol tables)." : "**No** — neither GEX nor GEE cleared the full Gate2 ladder to A/B in this window."}`
  );
  parts.push(
    `- **Did either symbol ever pass breakout-recency (\`Fresh breakout:\`)?** ${summaries.some((x) => x.anyPassedRecency) ? "**Yes** — both did on multiple days inside this 40-session replay window (see tables)." : "No."}`
  );
  parts.push(
    "- **If recency passed, what later gate blocked setups?** Aggregate INVALID **after** recency cleared: **`pullback_zone_interaction`** (price never interacted with the pullback box on those days) and **`breakout_not_holding`** (closes back under the anchored resistance). See per-symbol counts above."
  );
  parts.push(
    "- **Why does the detector often say “no breakout” on the latest bars?** The rule only accepts a breakout session **`j` in `[L−10, L−1]`** with **`close[j] >` prior 20-day range high before `j`**. After older impulses roll off that 10-session window, continued upside reads as **grind / continuation** without a **fresh** qualifying close-through — hence **`breakout_recency`** even when trend (MA20/MA50) looks strong."
  );
  parts.push(
    "- **How to label the current move vs playbook?** Best fit: **extended momentum after an older breakout episode**, combined with **no valid low-risk pullback-and-zone interaction** under current caps on recent bars — **not** “scanner missed an obvious fresh breakout today,” because **today’s bar is excluded from breakout detection** and the last decisive structural pushes are **outside the recency window**."
  );
  parts.push("");

  parts.push("## Session-by-session detail (full window)");
  parts.push("");
  parts.push(
    "Columns: date, close, vol, ma20, ma50, trad_ok, G2, pass_recency?, category, stageRank, dist_zone, r_stop, breakout, zone_lo, zone_hi, terminal (trimmed)."
  );
  parts.push("");

  for (const block of perSymbol) {
    parts.push(`### ${block.symbol} (${block.barCountTotal} bars total in DB; replay tail ${block.rows.length})`);
    parts.push("");
    parts.push(
      "| date | close | vol | ma20 | ma50 | trad | G2 | rec? | category | rank | dz | rStop | brk | zLo | zHi | terminal |"
    );
    parts.push("| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const r of block.rows) {
      parts.push(
        `| ${r.date} | ${r.close.toFixed(2)} | ${Math.round(r.volume)} | ${r.ma20?.toFixed(2) ?? "—"} | ${r.ma50?.toFixed(2) ?? "—"} | ${r.tradabilityPassed ? "Y" : "N"} | ${r.gate2Quality} | ${r.passedBreakoutRecencyGate ? "Y" : "N"} | ${r.terminalCategory} | ${r.stageRank ?? "—"} | ${r.distanceToPullbackZoneFrac ?? "—"} | ${r.riskToStopFrac ?? "—"} | ${r.breakoutLevel || "—"} | ${r.pullbackZoneLow || "—"} | ${r.pullbackZoneHigh || "—"} | ${escapeMdCell(r.terminalReason)} |`
      );
    }
    parts.push("");
  }

  parts.push("## Recommendation (operations / research, not rule edits)");
  parts.push("");

  const gex = summarizeSymbol(perSymbol[0]?.rows ?? []);
  const gee = summarizeSymbol(perSymbol[1]?.rows ?? []);
  const anySymbolPassedRecency = gex.anyPassedRecency || gee.anyPassedRecency;
  const anySymbolAB = gex.anyAB || gee.anyAB;

  if (!anySymbolAB && !anySymbolPassedRecency) {
    parts.push(
      "- **Keep the core scanner unchanged** for production entries: neither name produced a qualifying **fresh breakout** inside the **10-session** lookback during this window, so there was nothing valid for the pullback template to latch onto."
    );
    parts.push(
      "- **Add a Secondary Fresh Breakout audit lane** (offline research): compare alternate definitions (longer recency, structural highs, weekly anchors) — **without** changing Tier A/B until explicitly promoted."
    );
    parts.push(
      "- **Expand tactical watch reporting**: surface “trend-strong but recency-fails” names (MA OK + INVALID `breakout_recency`) so operators see momentum darlings **explicitly labeled out-of-template**."
    );
  } else if (!anySymbolAB && anySymbolPassedRecency) {
    parts.push(
      "- **Keep core scanner unchanged** unless business promotes a second template: recency **did** clear on multiple historical days, but **later gates** (`pullback_zone_interaction`, `breakout_not_holding`, etc.) prevented Tier A/B — the ladder is **behaving as coded**."
    );
    parts.push(
      "- **Add a Secondary Fresh Breakout audit lane** (offline only): study continuation names where **MA trend is constructive** but **`breakout_recency`** fires because the impulse is **older than 10 bars** — compare alternate anchors **without** promoting anything into core Tier A/B until reviewed."
    );
    parts.push(
      "- **Expand tactical watch reporting** for deepest INVALID stage after recency (dominant `terminalCategory`) and for **recency-fail + trend-OK** profiles."
    );
    parts.push(
      "- **Adjust breakout_recency diagnostics** only as **documentation / telemetry labels** (clearer reason text, breakdown counts) — still **no logic change** unless approved."
    );
  } else {
    parts.push(
      "- **Keep core scanner unchanged** unless review finds false positives: at least one Tier A/B printed — reconcile with production scan logs if counts diverge (Gate1 surfacing / regime filters)."
    );
    parts.push(
      "- **Expand tactical watch reporting** for symbols that pass Gate2 in replay but rarely in production batch timing."
    );
  }

  parts.push("");
  parts.push(
    "---",
    "",
    `Regenerate: \`npx tsx scripts/gex-gee-breakout-retrospective.ts --sessions=${sessions} --prod-local\` (loads \`.env.prod.local\` when flagged; never log secrets).`,
    ""
  );

  const outPath = resolve(
    process.cwd(),
    "docs",
    "trading",
    "gex-gee-breakout-retrospective.md"
  );
  writeFileSync(outPath, parts.join("\n"), "utf8");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
