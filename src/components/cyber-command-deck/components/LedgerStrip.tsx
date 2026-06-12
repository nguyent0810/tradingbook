"use client";

import Link from "next/link";
import type { V3LedgerPulse } from "../types";

type Props = {
  data: V3LedgerPulse;
};

export function LedgerStrip({ data }: Props) {
  return (
    <section
      className="ccd-panel ccd-ledger"
      aria-label="Ledger pulse strip"
      data-testid="dashboard-cyber-ledger"
    >
      <div>
        <span className="ccd-label">Recent outcomes</span>
        {data.outcomeChips.length > 0 ? (
          <div className="ccd-ledger__chips mt-1">
            {data.outcomeChips.map((chip, index) => (
              <span
                key={`${chip}-${index}`}
                className={`ccd-ledger__chip ${chip === "W" ? "ccd-ledger__chip--win" : "ccd-ledger__chip--loss"}`}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <strong className="ccd-metric block mt-1 text-sm">No closed trades yet</strong>
        )}
      </div>

      <div>
        <span className="ccd-label">Open trades</span>
        <strong className="ccd-metric block mt-1">{data.openTrades}</strong>
      </div>

      <div>
        <span className="ccd-label">P&amp;L pulse</span>
        <strong className="ccd-metric block mt-1">{data.pnlPulse ?? "—"}</strong>
        {data.pulseBarHeights.length > 0 ? (
          <div className="ccd-ledger__bars" aria-hidden>
            {data.pulseBarHeights.map((value, index) => (
              <i key={`pulse-${index}`} style={{ height: `${value}%` }} />
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <span className="ccd-label">Trade review</span>
        <Link
          href={data.reviewHref}
          className="ccd-metric block mt-1 text-[#00F0FF] hover:underline"
        >
          {data.reviewLabel}
        </Link>
      </div>
    </section>
  );
}
