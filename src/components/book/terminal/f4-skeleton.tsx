import { Panel, PanelSkeleton } from "@/components/terminal";

/** Trạng thái đang tải của F4 — giữ nguyên dải KPI và khung bảng, không spinner. */
export function F4Skeleton() {
  return (
    <div className="f4" aria-busy="true" data-testid="book-loading">
      <div className="f4__kpis">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="f4-kpi">
            <span className="tm-skel-bar" style={{ display: "block", width: 84, marginBottom: 5 }} />
            <span className="tm-skel-bar" style={{ display: "block", width: 62, height: 14 }} />
          </div>
        ))}
        <div className="f4__equity">
          <div className="f4-kpi__k">ĐƯỜNG VỐN THỰC HIỆN</div>
          <span className="tm-skel-bar" style={{ display: "block", width: 160, height: 20, marginTop: 4 }} />
        </div>
      </div>

      <div className="f4__body">
        <Panel className="f4__open" title="LỆNH ĐANG MỞ" tone="up" body="scroll">
          <PanelSkeleton
            rows={3}
            columns={[40, 32, 44, 48, 56, 44, 44, 62, 44, 40, 56, 40, 120]}
            label="Đang tải lệnh đang mở"
          />
        </Panel>
        <div className="f4__bottom">
          <Panel className="f4__closed" title="LỆNH ĐÃ ĐÓNG" tone="floor" body="scroll">
            <PanelSkeleton
              rows={10}
              columns={[40, 62, 62, 44, 48, 48, 62, 44, 110]}
              dense
              label="Đang tải lệnh đã đóng"
            />
          </Panel>
          <Panel className="f4__risk" title="SỔ NHẬT KÝ RỦI RO" tone="accent" body="none">
            <PanelSkeleton rows={12} columns={[62, 170]} dense label="Đang tải sổ nhật ký rủi ro" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
