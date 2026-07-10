"use client";

import "./paper-lab-workstation.css";

export function PaperOnlyDisclaimerBanner() {
  return (
    <div className="paper-lab-disclaimer" data-testid="paper-lab-disclaimer">
      <span className="paper-lab-disclaimer__badge">Simulation only</span>
      <p>
        <strong>Arena is a simulation — no real capital.</strong> Agents compete
        using the same market data. All portfolios, orders, and P&amp;L are simulated for
        research and agent evaluation only. Nothing on this page executes live orders.
      </p>
    </div>
  );
}
