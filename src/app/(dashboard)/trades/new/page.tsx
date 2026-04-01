import type { Metadata } from "next";
import { TradeForm } from "@/components/trade-form";

export const metadata: Metadata = {
  title: "New Trade — TradeLog",
  description: "Log a new trade.",
};

export default function NewTradePage() {
  return (
    <div className="page-container animate-in">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Log a Trade
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Record your trade details. P&L is computed automatically for closed
            trades.
          </p>
        </div>

        <div className="card p-6">
          <TradeForm />
        </div>
      </div>
    </div>
  );
}
