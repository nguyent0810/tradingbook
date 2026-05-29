import "server-only";

import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import { analyzeMarketDataAlignment } from "@/lib/market/market-data-alignment";
import { SetupsPipelineContext } from "@/components/setups/setups-pipeline-context";
import { loadSetupsBaseData } from "./setups-cached-data";

export async function SetupsPipelineContextAsync() {
  const base = await loadSetupsBaseData();

  const marketAlignment = analyzeMarketDataAlignment({
    benchmarkSessionDate: base.expectedSession,
    latestEquityBarSessionDate: base.latestEquityBarSession,
    latestScanRunAt: base.latest?.runAt ?? null,
  });

  const freshness = buildMarketFreshnessDto({
    snapshot: {
      benchmarkSessionDate: base.expectedSession,
      latestEquityBarSessionDate: base.latestEquityBarSession,
      latestScanRunAt: base.latest?.runAt ?? null,
    },
    alignment: marketAlignment,
    delayedBackdropFromScanNotes:
      base.notes?.benchmarkBackdrop?.delayedBackdrop === true,
    scanSessionCoverage: base.notes?.sessionCoverage ?? null,
  });

  const nearMissCount = base.notes?.closestToValidSymbols?.length ?? 0;

  return (
    <SetupsPipelineContext
      freshness={freshness}
      latestScan={base.latest}
      nearMissCount={nearMissCount}
    />
  );
}
