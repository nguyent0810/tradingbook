import { Panel, PanelSkeleton } from "@/components/terminal";

/**
 * Trạng thái đang tải của F2 — giữ nguyên dải phễu và khung ba cột để layout
 * không nhảy khi dữ liệu về. Không spinner.
 */
export function F2Skeleton() {
  return (
    <div className="f2" aria-busy="true" data-testid="setups-loading">
      <div className="f2__funnel">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="f2-funnel__cell">
            <span className="f2-funnel__rule" style={{ background: "var(--tm-line-panel)" }} />
            <div style={{ minWidth: 0 }}>
              <span className="tm-skel-bar" style={{ display: "block", width: 88, marginBottom: 5 }} />
              <span className="tm-skel-bar" style={{ display: "block", width: 54, height: 14 }} />
            </div>
          </div>
        ))}
        <div className="f2-funnel__meta">
          <div className="f2-funnel__k">LẦN QUÉT</div>
          <span className="tm-skel-bar" style={{ display: "block", width: 96 }} />
        </div>
      </div>

      <div className="f2__body">
        <div className="f2__list">
          <Panel title="ỨNG VIÊN ĐÃ LỌC" tone="up" body="none" style={{ flex: 1, minHeight: 0 }}>
            <PanelSkeleton rows={6} columns={[16, 120, 32]} label="Đang tải ứng viên" />
          </Panel>
        </div>

        <div className="f2__center">
          <Panel title="HỒ SƠ THIẾT LẬP" tone="accent" body="pad" style={{ flex: "none" }}>
            <PanelSkeleton rows={6} columns={[140, 90, 90, 90]} label="Đang tải hồ sơ thiết lập" />
          </Panel>
          <Panel title="TIÊU CHÍ CỔNG 2" tone="up" body="none" style={{ flex: "none" }}>
            <PanelSkeleton rows={6} columns={[14, 200, 44]} dense label="Đang tải tiêu chí Cổng 2" />
          </Panel>
        </div>

        <Panel className="f2__log" title="NHẬT KÝ BỘ QUÉT" tone="floor" body="none">
          <PanelSkeleton rows={12} columns={[54, 180]} dense label="Đang tải nhật ký bộ quét" />
        </Panel>
      </div>
    </div>
  );
}
