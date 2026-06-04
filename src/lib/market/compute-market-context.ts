import type { Gate1ScanLevel, ForeignDataQuality } from "@/generated/prisma/client";
import { evaluateMarketRegime } from "@/lib/playbook/gate1-market";
import { sma } from "@/lib/playbook/indicators";
import type { Bar } from "@/lib/market/types";
import { isoDayUtc } from "@/lib/market/session-date";

export type DailyBarPoint = {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ForeignDailyPoint = {
  sessionDate: Date;
  netValueVnd: number | null;
  dataQuality: ForeignDataQuality;
};

export type SymbolVolumeContext = {
  close: number | null;
  volume: number | null;
  volMa20: number | null;
  volRatioMa20: number | null;
};

export type SymbolForeignRollup = {
  foreignNetValue1d: number | null;
  foreignNetValue5d: number | null;
  foreignNetValue10d: number | null;
  foreignDataQuality: ForeignDataQuality | null;
};

export type MarketForeignRollup = {
  foreignNetValue1d: number | null;
  foreignNetValue5d: number | null;
  foreignNetValue10d: number | null;
  foreignSymbolsOk: number;
  foreignSymbolsTotal: number;
  foreignCoveragePct: number | null;
};

export type VnindexContext = {
  vnindexClose: number | null;
  vnindexMa20: number | null;
  vnindexMa50: number | null;
  vnindexVolume: number | null;
  vnindexVolMa20: number | null;
  vnindexVolRatioMa20: number | null;
  gate1Level: Gate1ScanLevel | null;
};

function sortBarsAsc(bars: readonly DailyBarPoint[]): DailyBarPoint[] {
  return [...bars].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function dedupeByDay(bars: readonly DailyBarPoint[]): DailyBarPoint[] {
  const byDay = new Map<string, DailyBarPoint>();
  for (const b of bars) {
    byDay.set(isoDayUtc(b.date), b);
  }
  return sortBarsAsc([...byDay.values()]);
}

/** Volume MA20 uses prior 20 sessions excluding eval bar (Gate 2 participation window). */
export function computeSymbolVolumeContext(
  barsAscThroughSession: readonly DailyBarPoint[],
  sessionDate: Date
): SymbolVolumeContext | null {
  const deduped = dedupeByDay(barsAscThroughSession);
  const sessionKey = isoDayUtc(sessionDate);
  const idx = deduped.findIndex((b) => isoDayUtc(b.date) === sessionKey);
  if (idx < 0) return null;

  const evalBar = deduped[idx]!;
  const prior = deduped.slice(Math.max(0, idx - 20), idx);
  if (prior.length < 20) {
    return {
      close: evalBar.close,
      volume: evalBar.volume,
      volMa20: null,
      volRatioMa20: null,
    };
  }

  const volMa20 = prior.reduce((s, b) => s + b.volume, 0) / prior.length;
  const volRatioMa20 = volMa20 > 0 ? evalBar.volume / volMa20 : null;

  return {
    close: evalBar.close,
    volume: evalBar.volume,
    volMa20,
    volRatioMa20,
  };
}

export function computeVnindexContext(
  indexBarsAscThroughSession: readonly DailyBarPoint[],
  sessionDate: Date
): VnindexContext {
  const deduped = dedupeByDay(indexBarsAscThroughSession);
  const sessionKey = isoDayUtc(sessionDate);
  const idx = deduped.findIndex((b) => isoDayUtc(b.date) === sessionKey);

  if (idx < 0) {
    return {
      vnindexClose: null,
      vnindexMa20: null,
      vnindexMa50: null,
      vnindexVolume: null,
      vnindexVolMa20: null,
      vnindexVolRatioMa20: null,
      gate1Level: null,
    };
  }

  const closes = deduped.map((b) => b.close);
  const volumes = deduped.map((b) => b.volume);
  const ma20Series = sma(closes, 20);
  const ma50Series = sma(closes, 50);
  const evalBar = deduped[idx]!;

  const priorVol = deduped.slice(Math.max(0, idx - 20), idx);
  const volMa20 =
    priorVol.length >= 20
      ? priorVol.reduce((s, b) => s + b.volume, 0) / priorVol.length
      : null;
  const volRatioMa20 =
    volMa20 != null && volMa20 > 0 ? evalBar.volume / volMa20 : null;

  const barsForGate1: Bar[] = deduped.slice(0, idx + 1).map((b) => ({
    time: b.date.getTime(),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));
  const regime = evaluateMarketRegime(barsForGate1);

  return {
    vnindexClose: evalBar.close,
    vnindexMa20: ma20Series[idx] ?? null,
    vnindexMa50: ma50Series[idx] ?? null,
    vnindexVolume: evalBar.volume,
    vnindexVolMa20: volMa20,
    vnindexVolRatioMa20: volRatioMa20,
    gate1Level: regime.level,
  };
}

function okForeignPoints(points: readonly ForeignDailyPoint[]): ForeignDailyPoint[] {
  return points.filter(
    (p) => p.dataQuality === "OK" && p.netValueVnd != null && Number.isFinite(p.netValueVnd)
  );
}

/** Rolling sum of netValueVnd over last N OK session rows including current when present. */
export function computeSymbolForeignRollup(
  historyAscThroughSession: readonly ForeignDailyPoint[],
  sessionDate: Date
): SymbolForeignRollup {
  const sessionKey = isoDayUtc(sessionDate);
  const deduped = new Map<string, ForeignDailyPoint>();
  for (const p of historyAscThroughSession) {
    deduped.set(isoDayUtc(p.sessionDate), p);
  }
  const current = deduped.get(sessionKey) ?? null;

  const foreignDataQuality = current?.dataQuality ?? null;
  const foreignNetValue1d =
    current?.dataQuality === "OK" && current.netValueVnd != null
      ? current.netValueVnd
      : null;

  const okPoints = okForeignPoints(
    sortForeignAsc([...deduped.values()]).filter((p) => isoDayUtc(p.sessionDate) <= sessionKey)
  );

  return {
    foreignNetValue1d,
    foreignNetValue5d: rollingSumLastN(okPoints, 5),
    foreignNetValue10d: rollingSumLastN(okPoints, 10),
    foreignDataQuality,
  };
}

function sortForeignAsc(points: readonly ForeignDailyPoint[]): ForeignDailyPoint[] {
  return [...points].sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());
}

function rollingSumLastN(points: readonly ForeignDailyPoint[], n: number): number | null {
  if (points.length < n) return null;
  const tail = points.slice(-n);
  return tail.reduce((s, p) => s + (p.netValueVnd ?? 0), 0);
}

export function computeMarketForeignRollup(params: {
  symbolRollups: readonly SymbolForeignRollup[];
  marketHistory1d: readonly { sessionDate: Date; foreignNetValue1d: number | null }[];
  sessionDate: Date;
}): MarketForeignRollup {
  const { symbolRollups, marketHistory1d, sessionDate } = params;
  const sessionKey = isoDayUtc(sessionDate);

  let foreignSymbolsOk = 0;
  let foreignNetValue1d = 0;
  let has1d = false;

  for (const r of symbolRollups) {
    if (r.foreignNetValue1d != null) {
      foreignSymbolsOk++;
      foreignNetValue1d += r.foreignNetValue1d;
      has1d = true;
    }
  }

  const foreignSymbolsTotal = symbolRollups.length;
  const foreignCoveragePct =
    foreignSymbolsTotal > 0 ? foreignSymbolsOk / foreignSymbolsTotal : null;

  const historyDedup = new Map<string, number | null>();
  for (const row of marketHistory1d) {
    historyDedup.set(isoDayUtc(row.sessionDate), row.foreignNetValue1d);
  }
  historyDedup.set(sessionKey, has1d ? foreignNetValue1d : null);

  const historyAsc = [...historyDedup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([day]) => day <= sessionKey)
    .map(([, v]) => v)
    .filter((v): v is number => v != null);

  return {
    foreignNetValue1d: has1d ? foreignNetValue1d : null,
    foreignNetValue5d:
      historyAsc.length >= 5
        ? historyAsc.slice(-5).reduce((s, v) => s + v, 0)
        : null,
    foreignNetValue10d:
      historyAsc.length >= 10
        ? historyAsc.slice(-10).reduce((s, v) => s + v, 0)
        : null,
    foreignSymbolsOk,
    foreignSymbolsTotal,
    foreignCoveragePct,
  };
}
