import { Panel, PanelSkeleton } from "@/components/terminal";

/** Trạng thái đang tải của F3 — giữ nguyên khung hai cột, không spinner. */
export function F3Skeleton() {
  return (
    <div className="f3" aria-busy="true" data-testid="paper-lab-loading">
      <div className="f3__disclaimer">
        <span className="f3__disclaimer-tag">MÔ PHỎNG</span>
        <span className="f3__disclaimer-text">
          Không dùng vốn thật — mọi danh mục, lệnh và kết quả trên màn này đều là giả lập.
        </span>
      </div>

      <div className="f3__body">
        <div className="f3__main">
          <Panel className="f3__leaderboard" title="BẢNG XẾP HẠNG TÁC TỬ" tone="accent" body="scroll">
            <PanelSkeleton
              rows={6}
              columns={[24, 110, 34, 40, 56, 44, 56, 48, 62]}
              label="Đang tải bảng xếp hạng"
            />
          </Panel>
          <Panel className="f3__battles" title="TRẬN ĐẤU CÙNG MÃ" tone="ceil" body="scroll">
            <PanelSkeleton
              rows={9}
              columns={[62, 40, 62, 44, 90, 48, 160]}
              dense
              label="Đang tải trận đấu"
            />
          </Panel>
        </div>

        <div className="f3__rail">
          <Panel title="BẢNG VÀNG" tone="ref" body="none">
            <PanelSkeleton rows={5} columns={[14, 150, 44]} label="Đang tải bảng vàng" />
          </Panel>
          <Panel title="NGƯỜI vs TÁC TỬ" tone="floor" body="none">
            <PanelSkeleton rows={8} columns={[54, 180]} dense label="Đang tải nhật ký người vs tác tử" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
