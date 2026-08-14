/**
 * READ-ONLY: answers two review challenges with measurement rather than argument.
 *
 *   (a) Is month clustering the only clustering that matters, or does the same
 *       symbol contributing several setups need its own cluster level? The
 *       reviewer proposed two-way (symbol × month) clustering.
 *   (b) How fast does the frozen forward universe lose members? The forward
 *       protocol's 6.6-year estimate assumes a constant setup rate; attrition
 *       would stretch it.
 *
 *   npx tsx scripts/replay/audit-oos-clustering.ts
 */
import "../load-env";
import { readFileSync } from "node:fs";
import { GATE2_RANGE_DAYS } from "../../src/lib/scanner/gate2/constants";

type Setup = { sessionDate: string; symbol: string; breakoutLevel: number; outcome: string | null };

function dedupe(rows: Setup[]): Setup[] {
  const bySymbol = new Map<string, Setup[]>();
  for (const r of [...rows].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))) {
    const arr = bySymbol.get(r.symbol) ?? [];
    arr.push(r);
    bySymbol.set(r.symbol, arr);
  }
  const kept: Setup[] = [];
  for (const [, arr] of bySymbol) {
    const anchors: Setup[] = [];
    for (const r of arr) {
      const dup = anchors.some(
        (a) =>
          a.breakoutLevel > 0 &&
          Math.abs(r.breakoutLevel - a.breakoutLevel) / a.breakoutLevel <= 0.005 &&
          (Date.parse(r.sessionDate) - Date.parse(a.sessionDate)) / 86_400_000 <= GATE2_RANGE_DAYS * 1.45,
      );
      if (!dup) anchors.push(r);
    }
    kept.push(...anchors);
  }
  return kept;
}

function icc(groups: number[][]): { rho: number; k: number; mbar: number } {
  const k = groups.length;
  const n = groups.reduce((a, g) => a + g.length, 0);
  if (k < 2 || n <= k) return { rho: 0, k, mbar: n / Math.max(1, k) };
  const grand = groups.flat().reduce((a, x) => a + x, 0) / n;
  let msb = 0;
  for (const g of groups) {
    const m = g.reduce((a, x) => a + x, 0) / g.length;
    msb += g.length * (m - grand) ** 2;
  }
  msb /= k - 1;
  let msw = 0;
  for (const g of groups) {
    const m = g.reduce((a, x) => a + x, 0) / g.length;
    msw += g.reduce((a, x) => a + (x - m) ** 2, 0);
  }
  msw /= n - k;
  const sizes = groups.map((g) => g.length);
  const m0 = (n - sizes.reduce((a, s) => a + s * s, 0) / n) / (k - 1);
  const v = (msb - msw) / m0;
  return { rho: v <= 0 ? 0 : v / (v + msw), k, mbar: n / k };
}

function main(): void {
  const raw: Setup[] = readFileSync("docs/trading/replay/continuation/setups.ndjson", "utf-8")
    .trim()
    .split(/\r?\n/)
    .map((l) => JSON.parse(l));
  const scored = dedupe(raw).filter(
    (r) => r.outcome === "CONTINUATION" || r.outcome === "FAILURE",
  );

  const group = (key: (r: Setup) => string) => {
    const m = new Map<string, number[]>();
    for (const r of scored) {
      const k = key(r);
      const a = m.get(k) ?? [];
      a.push(r.outcome === "CONTINUATION" ? 1 : 0);
      m.set(k, a);
    }
    return [...m.values()];
  };

  console.log(`scored setups = ${scored.length}`);
  for (const [label, g] of [
    ["month", group((r) => r.sessionDate.slice(0, 7))],
    ["symbol", group((r) => r.symbol)],
    ["quarter", group((r) => `${r.sessionDate.slice(0, 4)}Q${Math.ceil(Number(r.sessionDate.slice(5, 7)) / 3)}`)],
  ] as const) {
    const { rho, k, mbar } = icc(g);
    const deff = 1 + (mbar - 1) * rho;
    console.log(
      `  by ${label.padEnd(8)} clusters=${String(k).padStart(4)} mean size=${mbar.toFixed(2).padStart(6)} ICC=${rho.toFixed(4)} designEffect=${deff.toFixed(3)}`,
    );
  }

  // Symbol repeat structure — how much scope is there for within-symbol
  // dependence in the first place?
  const bySym = new Map<string, number>();
  for (const r of scored) bySym.set(r.symbol, (bySym.get(r.symbol) ?? 0) + 1);
  const counts = [...bySym.values()].sort((a, b) => b - a);
  console.log(
    `\nsymbols contributing setups = ${counts.length}; max per symbol = ${counts[0]}; ` +
      `median = ${counts[Math.floor(counts.length / 2)]}; singletons = ${counts.filter((c) => c === 1).length}`,
  );
}

main();
