"use client";

import Link from "next/link";
import type { V3LedgerPulse } from "@/lib/dashboard/dashboard-v3-view-model";
import { Card } from "./ui/card";

type Props = {
  data: V3LedgerPulse;
};

export function LedgerPulseBar({ data }: Props) {
  return (
    <Card
      className="p-4 cd-span-12 grid grid-cols-2 md:grid-cols-4 gap-4"
      data-testid="dashboard-cyber-ledger"
      aria-label="Ledger pulse strip"
    >
      <div>
        <span className="cd-kicker">Recent outcomes</span>
        {data.outcomeChips.length > 0 ? (
          <div className="flex gap-1 mt-2">
            {data.outcomeChips.map((chip, i) => (
              <span
                key={`${chip}-${i}`}
                className={`cd-mono text-xs px-2 py-0.5 rounded ${chip === "W" ? "cd-tone-success" : "cd-tone-danger"}`}
                style={{
                  background: chip === "W" ? "rgba(0,230,118,0.12)" : "rgba(244,63,94,0.12)",
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <strong className="block mt-2 text-sm">No closed positions yet</strong>
        )}
      </div>

      <div>
        <span className="cd-kicker">Open positions</span>
        <strong className="cd-mono cd-ledger-value block mt-2">{data.openTrades}</strong>
      </div>

      <div>
        <span className="cd-kicker">P&amp;L pulse</span>
        <strong className="cd-mono cd-ledger-value block mt-2">{data.pnlPulse ?? "—"}</strong>
      </div>

      <div>
        <span className="cd-kicker">Session review</span>
        <Link
          href={data.reviewHref}
          className="block mt-2 text-sm underline"
          style={{ color: "var(--cd-cyan)" }}
        >
          {data.reviewLabel}
        </Link>
      </div>
    </Card>
  );
}
