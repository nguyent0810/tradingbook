import Link from "next/link";
import { CommandDeckZone } from "@/components/command-deck";
import type { ReviewQueueModel } from "@/lib/trades/review-priority-queue";
import type { ReviewQueueSymbol } from "@/lib/trades/review-priority-queue";

function ReviewQueueSymbolLinks({ items }: { items: ReviewQueueSymbol[] }) {
  if (items.length === 0) return null;
  return (
    <span className="ledger-review-queue__symbols">
      {items.map((s, i) => (
        <span key={s.tradeId} className="ledger-review-queue__symbol-item">
          {i > 0 ? (
            <span className="ledger-review-queue__sep" aria-hidden>
              ·
            </span>
          ) : null}
          <Link href={`/trades/${s.tradeId}`} className="ledger-review-queue__link mono">
            {s.symbol}
          </Link>
        </span>
      ))}
    </span>
  );
}

export type TradesReviewQueueProps = {
  model: ReviewQueueModel;
  compactReview: boolean;
};

export function TradesReviewQueue({ model, compactReview }: TradesReviewQueueProps) {
  const emptyQueue =
    !model.urgent.length &&
    !model.highAttention.length &&
    !model.routinePending.length &&
    !model.staleMarket.length;

  return (
    <CommandDeckZone
      eyebrow="Attention"
      title={compactReview ? "Review queue" : "Review queue · daily bar context"}
      variant="primary"
      testId="trades-review-queue"
      className="ledger-review-queue"
    >
      <dl className="ledger-review-queue__list">
        {model.urgent.length > 0 ? (
          <div className="ledger-review-queue__row ledger-review-queue__row--urgent">
            <dt>{model.urgent.length} urgent</dt>
            <dd>
              <ReviewQueueSymbolLinks items={model.urgent} />
            </dd>
          </div>
        ) : null}
        {model.highAttention.length > 0 ? (
          <div className="ledger-review-queue__row ledger-review-queue__row--high">
            <dt>{model.highAttention.length} high attention</dt>
            <dd>
              <ReviewQueueSymbolLinks items={model.highAttention} />
            </dd>
          </div>
        ) : null}
        {model.routinePending.length > 0 ? (
          <div className="ledger-review-queue__row">
            <dt>{model.routinePending.length} routine reviews pending</dt>
            <dd>
              <ReviewQueueSymbolLinks items={model.routinePending} />
            </dd>
          </div>
        ) : null}
        {model.staleMarket.length > 0 ? (
          <div className="ledger-review-queue__row">
            <dt>{model.staleMarket.length} stale market data</dt>
            <dd>
              <ReviewQueueSymbolLinks items={model.staleMarket} />
            </dd>
          </div>
        ) : null}
      </dl>
      {emptyQueue ? (
        <p className="ledger-review-queue__empty">
          Nothing flagged in the queue — quick-scan open rows below.
        </p>
      ) : null}
      <p className="ledger-review-queue__legend">
        {compactReview
          ? "Same sort as briefing — expand filters for full legend."
          : "Open rows sort for review: stop urgency · proximity to stress · drift vs last checkpoint · stale data or pending log · planned capital at risk · symbol."}
      </p>
    </CommandDeckZone>
  );
}
