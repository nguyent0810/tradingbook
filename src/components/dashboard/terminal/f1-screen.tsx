"use client";

import { useState } from "react";
import { ErrorState, StaleBanner } from "@/components/terminal";
import type { F1ViewModel } from "@/lib/dashboard/terminal/f1-view-model";
import { BlockersPanel } from "./blockers-panel";
import { EvidenceDrawer } from "./evidence-drawer";
import { Gate1Panel } from "./gate1-panel";
import { NearMissTable } from "./near-miss-table";
import { FunnelPanel, IndexPanel, PlanPanel, WatchlistPanel } from "./right-rail-panels";
import { SetupsTable } from "./setups-table";
import { RAIL_MAX, RAIL_MIN, useRailWidth } from "./use-rail-width";
import { VerdictPanel } from "./verdict-panel";

export type F1ScreenProps = {
  model: F1ViewModel;
  /** Banner dữ liệu cũ — `null` khi dữ liệu bám đúng phiên gần nhất. */
  stale: { sessionLabel: string; consequence: string } | null;
  /** Lỗi nạp từng phần, kèm bằng chứng thật. */
  loadError: string | null;
};

/**
 * Màn F1 · Bảng điều khiển.
 *
 * Ba cột: phán quyết + chẩn đoán (trái) · bảng thiết lập (giữa) · bối cảnh thị
 * trường (phải, kéo được). Cả màn đọc từ một view model duy nhất.
 */
export function F1Screen({ model, stale, loadError }: F1ScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const rail = useRailWidth();

  return (
    <div className="f1" data-testid="f1-dashboard">
      <div className="f1__rail-left">
        <VerdictPanel verdict={model.verdict} onOpenEvidence={() => setEvidenceOpen(true)} />
        <BlockersPanel blockers={model.blockers} emptyReason={model.blockersEmptyReason} />
        <Gate1Panel rows={model.gate1Rows} note={model.gate1Note} />
      </div>

      <div className="f1__center">
        {stale ? (
          <StaleBanner sessionLabel={stale.sessionLabel} consequence={stale.consequence} />
        ) : null}

        {loadError ? (
          <ErrorState
            title="Một phần dữ liệu bảng điều khiển không nạp được"
            note="Các panel bên dưới có thể trống hoặc thiếu cột. Phán quyết vẫn tính trên phần dữ liệu đọc được."
            evidence={loadError}
          />
        ) : null}

        <SetupsTable
          rows={model.setups}
          emptyReason={model.setupsEmptyReason}
          selected={selected}
          onSelect={setSelected}
          scanRunId={model.scanRunId}
        />
        <NearMissTable rows={model.nearMiss} emptyReason={model.nearMissEmptyReason} />
      </div>

      <div
        className="f1__grip"
        role="separator"
        aria-orientation="vertical"
        aria-label="Đổi bề rộng cột phải"
        aria-valuenow={rail.width}
        aria-valuemin={RAIL_MIN}
        aria-valuemax={RAIL_MAX}
        tabIndex={0}
        onPointerDown={rail.onPointerDown}
        onKeyDown={rail.onKeyDown}
      />

      <div className="f1__rail-right" style={{ width: rail.width }}>
        <IndexPanel index={model.index} />
        <FunnelPanel rows={model.funnel} />
        <PlanPanel rows={model.plan} />
        <WatchlistPanel rows={model.watch} truncated={model.watchTruncated} />
      </div>

      {evidenceOpen ? (
        <EvidenceDrawer
          rows={model.evidence}
          scanRunId={model.scanRunId}
          gate1Note={model.gate1Note}
          onClose={() => setEvidenceOpen(false)}
        />
      ) : null}
    </div>
  );
}
