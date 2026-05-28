import Link from "next/link";
import { EmptyStateWithReason } from "@/components/ui/empty-state-with-reason";

const ledgerEmptyIcon = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export type TradesLedgerEmptyProps = {
  filtered: boolean;
};

export function TradesLedgerEmpty({ filtered }: TradesLedgerEmptyProps) {
  return (
    <div className="ledger-deck-panel pipeline-deck-panel">
      <EmptyStateWithReason
        title={filtered ? "No matching trades" : "No trades yet"}
        reason={
          filtered
            ? "Try adjusting your search or filters — the ledger only shows rows that match the current query."
            : "Log your first trade to start tracking performance, review checkpoints, and operating posture."
        }
        icon={ledgerEmptyIcon}
        data-testid={filtered ? "trades-ledger-empty-filtered" : "trades-ledger-empty"}
      >
        {!filtered ? (
          <Link href="/trades/new" className="btn btn-primary btn-sm">
            Log your first trade
          </Link>
        ) : null}
      </EmptyStateWithReason>
    </div>
  );
}
