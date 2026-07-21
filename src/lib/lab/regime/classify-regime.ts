import type { PrismaClient } from "@/generated/prisma/client";
import { evaluateMarketRegime } from "@/lib/playbook/gate1-market";
import { sma } from "@/lib/playbook/indicators";
import { LAB_REGIME_SCHEMA_VERSION } from "@/lib/paper-lab/constants";
import type { RegimeDimensions, RegimeSnapshot } from "@/lib/lab/types/regime";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Slope magnitude below this is considered flat/sideways rather than trending. */
const SIDEWAYS_SLOPE_THRESHOLD = 0.005;

function classifyTrend(close: number, ma50: number, ma20: number | null): RegimeDimensions["trendRegime"] {
  const above50 = close > ma50;
  const slope = ma20 != null && ma50 > 0 ? (ma20 - ma50) / ma50 : 0;
  if (Math.abs(slope) <= SIDEWAYS_SLOPE_THRESHOLD) return "Sideways";
  if (above50 && slope > 0.02) return "StrongBull";
  if (above50) return "WeakBull";
  if (!above50 && slope < -0.02) return "StrongBear";
  return "WeakBear";
}

function classifyVolatility(atrPct: number): RegimeDimensions["volatilityRegime"] {
  if (atrPct > 0.025) return "HighVol";
  if (atrPct < 0.012) return "LowVol";
  return atrPct > 0.018 ? "Expanding" : "Contracting";
}

function classifyStructure(drawdownPct: number, volHigh: boolean): RegimeDimensions["structureRegime"] {
  if (drawdownPct > 0.15 && volHigh) return "Capitulation";
  if (drawdownPct > 0.08) return "Distribution";
  if (drawdownPct < 0.03 && !volHigh) return "Recovery";
  return "Normal";
}

export async function classifyRegimeForSession(
  prisma: PrismaClient,
  sessionDate: Date
): Promise<RegimeSnapshot> {
  const indexBarsDesc = await prisma.indexDailyBar.findMany({
    where: { symbol: "VNINDEX", date: { lte: sessionDate } },
    orderBy: { date: "desc" },
    take: 260,
  });
  const indexBars = [...indexBarsDesc].reverse();

  const bars = indexBars.map((b) => ({
    time: b.date.getTime(),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  const hasSufficientData = bars.length >= 50;
  const gate1 = hasSufficientData ? evaluateMarketRegime(bars) : null;
  const closes = bars.map((b) => b.close);
  const lastClose = closes[closes.length - 1] ?? 0;
  const ma50Series = sma(closes, 50);
  const ma20Series = sma(closes, 20);
  const ma50 = ma50Series[ma50Series.length - 1] ?? lastClose;
  const ma20 = ma20Series[ma20Series.length - 1] ?? null;

  const recent = bars.slice(-14);
  const atr =
    recent.length > 0
      ? recent.reduce((s, b) => s + (b.high - b.low), 0) / recent.length
      : 0;
  const atrPct = lastClose > 0 ? atr / lastClose : 0;

  const peak60 = Math.max(...closes.slice(-60), lastClose);
  const drawdownPct = peak60 > 0 ? (peak60 - lastClose) / peak60 : 0;

  const ctx = await prisma.marketContextDaily.findUnique({
    where: { sessionDate },
  });

  const scan = await prisma.dailyScanRun.findFirst({
    where: { runAt: { lte: new Date(sessionDate.getTime() + 86400000) } },
    orderBy: { runAt: "desc" },
  });

  const liquidityRegime: RegimeDimensions["liquidityRegime"] =
    (ctx?.foreignCoveragePct ?? 0) >= 0.6 ? "HighLiquidity" : "LowLiquidity";

  let breadthRegime: RegimeDimensions["breadthRegime"] = "Rotation";
  if (scan) {
    const total = scan.candidateCountA + scan.candidateCountB;
    if (total >= 5 && gate1?.level === "PASS") breadthRegime = "RiskOn";
    else if (gate1?.level === "FAIL" || total === 0) breadthRegime = "RiskOff";
  }

  const dimensions: RegimeDimensions = {
    trendRegime: classifyTrend(lastClose, ma50, ma20),
    volatilityRegime: classifyVolatility(atrPct),
    liquidityRegime,
    breadthRegime,
    structureRegime: classifyStructure(drawdownPct, atrPct > 0.025),
    eventRegime: "Normal",
  };

  const labels = [
    dimensions.trendRegime,
    dimensions.volatilityRegime,
    dimensions.breadthRegime,
    gate1?.level ?? "UNKNOWN",
  ];

  return {
    sessionDate: isoDay(sessionDate),
    gate1Level: gate1?.level ?? null,
    dimensions,
    hasSufficientData,
    confidence: !hasSufficientData ? 0 : bars.length >= 120 ? 0.85 : 0.65,
    schemaVersion: LAB_REGIME_SCHEMA_VERSION,
    labels,
  };
}

export async function persistRegimeSnapshot(
  prisma: PrismaClient,
  snapshot: RegimeSnapshot
): Promise<Date> {
  const sessionDate = new Date(snapshot.sessionDate);
  await prisma.marketRegimeSnapshot.upsert({
    where: { sessionDate },
    create: {
      sessionDate,
      gate1Level: snapshot.gate1Level,
      dimensionsJson: snapshot.dimensions as object,
      confidence: snapshot.confidence,
      schemaVersion: snapshot.schemaVersion,
    },
    update: {
      gate1Level: snapshot.gate1Level,
      dimensionsJson: snapshot.dimensions as object,
      confidence: snapshot.confidence,
    },
  });
  return sessionDate;
}
