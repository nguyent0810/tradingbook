"use client";

import "./paper-lab-workstation.css";

export function PaperOnlyDisclaimerBanner() {
  return (
    <div className="paper-lab-disclaimer" data-testid="paper-lab-disclaimer">
      <span className="paper-lab-disclaimer__badge">Paper only</span>
      <p>
        <strong>AI Paper Trading Lab — no real trades.</strong> Virtual agents compete
        using the same market data. All portfolios, orders, and PnL are simulated for
        research and agent evaluation only. Nothing on this page executes live orders.
      </p>
    </div>
  );
}
