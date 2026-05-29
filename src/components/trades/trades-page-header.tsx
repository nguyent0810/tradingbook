import Link from "next/link";
import { V3PageHeader } from "@/components/trading-os-v3/shared/v3-page-header";

export type TradesPageHeaderProps = {
  tradeCount: number;
  openCount: number;
  closedCount: number;
};

export function TradesPageHeader({
  tradeCount,
  openCount,
  closedCount,
}: TradesPageHeaderProps) {
  return (
    <V3PageHeader
      kicker="Trading ledger"
      title="Trades workstation"
      lead={
        <>
          <span data-testid="trades-header-count">
            {tradeCount} trade{tradeCount !== 1 ? "s" : ""} in this view
          </span>
          {tradeCount > 0 ? (
            <>
              {" "}
              · <span className="tabular-nums">{openCount}</span> open ·{" "}
              <span className="tabular-nums">{closedCount}</span> closed
            </>
          ) : null}
        </>
      }
      testId="trades-page-header"
      actions={
        <Link href="/trades/new" className="tosv3-btn tosv3-btn--primary">
          Log trade
        </Link>
      }
    />
  );
}
