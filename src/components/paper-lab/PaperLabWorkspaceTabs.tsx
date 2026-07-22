"use client";

import type { PaperLabPageDto, RecentBattleSummaryDto } from "@/lib/paper-lab/types/arena-dto";
import type { OpenPositionRowDto } from "@/lib/paper-lab/types/arena-dto";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BattleReplayPanel } from "./BattleReplayPanel";
import { OpenPositionsTable } from "./OpenPositionsTable";
import "./paper-lab-command-center.css";
import "./paper-lab-workstation.css";

type WorkspaceTab = "positions" | "battle";

export function PaperLabWorkspaceTabs({
  positions,
  battleReplay,
  recentBattles,
}: {
  positions: OpenPositionRowDto[];
  battleReplay: PaperLabPageDto["battleReplay"];
  recentBattles: RecentBattleSummaryDto[];
}) {
  // Tab lives in the URL (?tab=battle) — consistent with the sibling section
  // index's ?focus= deep-linking, and survives browser back/forward instead of
  // silently resetting to "positions".
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: WorkspaceTab = searchParams.get("tab") === "battle" ? "battle" : "positions";

  const setTab = (next: WorkspaceTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "positions") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <section className="paper-lab-workspace" data-testid="paper-lab-workspace">
      <div className="paper-lab-workspace-tabs" role="tablist" aria-label="Không gian làm việc Đấu trường">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "positions"}
          className={`paper-lab-workspace-tab ${tab === "positions" ? "paper-lab-workspace-tab--active" : ""}`}
          data-testid="workspace-tab-positions"
          onClick={() => setTab("positions")}
        >
          Vị thế đang mở
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "battle"}
          className={`paper-lab-workspace-tab ${tab === "battle" ? "paper-lab-workspace-tab--active" : ""}`}
          data-testid="workspace-tab-battle"
          onClick={() => setTab("battle")}
        >
          Tái hiện đối đầu
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
            <BattleReplayPanel
              battleReplay={battleReplay}
              recentBattles={recentBattles}
              embedded
            />
          </div>
        )}
      </div>
    </section>
  );
}
