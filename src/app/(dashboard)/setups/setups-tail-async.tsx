import "server-only";

import { SetupsClosestSymbolsSection } from "@/components/setups-closest-symbols";
import { compareClosestRowsExecutionOrder } from "@/lib/scanner/closest-execution-metrics";
import { displayTradabilityBreakdownKey } from "@/lib/trading-display-labels";
import { loadSetupsBaseData } from "./setups-cached-data";

export async function SetupsTailAsync() {
  const base = await loadSetupsBaseData();
  if (!base.latest) return null;

  const closestRows = [...(base.notes?.closestToValidSymbols ?? [])].sort((a, b) =>
    compareClosestRowsExecutionOrder(
      {
        rankScore: a.rankScore,
        close: a.close,
        pullbackZoneLow: a.pullbackZoneLow,
        pullbackZoneHigh: a.pullbackZoneHigh,
        symbol: a.symbol,
        partialPipelineScore: a.partialPipelineScore,
        stageRank: a.stageRank,
        reasonLineCount: a.reasonLineCount,
      },
      {
        rankScore: b.rankScore,
        close: b.close,
        pullbackZoneLow: b.pullbackZoneLow,
        pullbackZoneHigh: b.pullbackZoneHigh,
        symbol: b.symbol,
        partialPipelineScore: b.partialPipelineScore,
        stageRank: b.stageRank,
        reasonLineCount: b.reasonLineCount,
      }
    )
  );

  const breakdown = base.latest.tradabilityBreakdown;

  return (
    <>
      {closestRows.length > 0 ? <SetupsClosestSymbolsSection rows={closestRows} /> : null}

      {breakdown && typeof breakdown === "object" && breakdown !== null ? (
        <details
          className="details-disclosure card p-5 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          <summary
            className="cursor-pointer text-base font-medium outline-none"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="details-marker-closed mr-2 inline text-[var(--text-tertiary)]" aria-hidden>
              ▸
            </span>
            <span className="details-marker-open mr-2 inline text-[var(--text-tertiary)]" aria-hidden>
              ▾
            </span>
            Liquidity &amp; session filter (technical detail)
          </summary>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            Why symbols were excluded before setup scoring (scanner diagnostic keys shown as readable
            labels).
          </p>
          <ul className="mt-3 space-y-1.5">
            {Object.entries(breakdown as Record<string, number>).map(([reason, count]) => (
              <li key={reason}>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {count}×
                </span>{" "}
                {displayTradabilityBreakdownKey(reason)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
