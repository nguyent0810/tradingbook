"use client";

import type { PaperLabPageDto } from "@/lib/paper-lab/types/arena-dto";
import type { OpenPositionRowDto } from "@/lib/paper-lab/types/arena-dto";
import { useState } from "react";
import { BattleReplayPanel } from "./BattleReplayPanel";
import { OpenPositionsTable } from "./OpenPositionsTable";
import "./paper-lab-command-center.css";
import "./paper-lab-workstation.css";

type WorkspaceTab = "positions" | "battle";

export function PaperLabWorkspaceTabs({
  positions,
  battleReplay,
}: {
  positions: OpenPositionRowDto[];
  battleReplay: PaperLabPageDto["battleReplay"];
}) {
  const [tab, setTab] = useState<WorkspaceTab>("positions");

  return (
    <section className="paper-lab-workspace" data-testid="paper-lab-workspace">
      <div className="paper-lab-workspace-tabs" role="tablist" aria-label="Arena workspace">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "positions"}
          className={`paper-lab-workspace-tab ${tab === "positions" ? "paper-lab-workspace-tab--active" : ""}`}
          data-testid="workspace-tab-positions"
          onClick={() => setTab("positions")}
        >
          Open Positions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "battle"}
          className={`paper-lab-workspace-tab ${tab === "battle" ? "paper-lab-workspace-tab--active" : ""}`}
          data-testid="workspace-tab-battle"
          onClick={() => setTab("battle")}
        >
          Battle Replay
        </button>
      </div>

      <div className="paper-lab-workspace-body paper-lab-panel paper-lab-panel--elevated">
        {tab === "positions" && (
          <div role="tabpanel" data-testid="paper-lab-positions-panel">
            <OpenPositionsTable positions={positions} embedded />
          </div>
        )}
        {tab === "battle" && (
          <div role="tabpanel" data-testid="paper-lab-battle-panel">
            <BattleReplayPanel battleReplay={battleReplay} embedded />
          </div>
        )}
      </div>
    </section>
  );
}
