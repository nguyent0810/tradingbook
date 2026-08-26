import { Panel, PanelSkeleton } from "@/components/terminal";
import { RAIL_DEFAULT } from "./use-rail-width";

/**
 * Trạng thái đang tải của F1.
 *
 * Giữ nguyên khung ba cột và đúng chiều cao hàng thật (26px / 23px) để layout
 * không nhảy khi dữ liệu về. Không spinner (bàn giao §6).
 */
export function F1Skeleton() {
  return (
    <div className="f1" aria-busy="true" data-testid="dashboard-cockpit-loading">
      <div className="f1__rail-left">
        <Panel title="PHÁN QUYẾT PHIÊN" tone="accent" body="pad">
          <PanelSkeleton rows={4} columns={[110, 180]} label="Đang tải phán quyết phiên" />
        </Panel>
        <Panel title="YẾU TỐ CHẶN" tone="down" body="none">
          <PanelSkeleton rows={3} columns={[64, 150]} label="Đang tải yếu tố chặn" />
        </Panel>
        <Panel title="CỔNG 1 · CHẾ ĐỘ THỊ TRƯỜNG" tone="accent" body="pad">
          <PanelSkeleton rows={4} columns={[120, 60]} dense label="Đang tải chế độ thị trường" />
        </Panel>
      </div>

      <div className="f1__center">
        <Panel className="f1__setups" title="THIẾT LẬP HẠNG A/B" tone="up" body="scroll">
          <PanelSkeleton
            rows={5}
            columns={[44, 18, 38, 46, 44, 78, 46, 40, 74, 54, 120]}
            label="Đang tải bảng thiết lập"
          />
        </Panel>
        <Panel className="f1__near-miss" title="SUÝT ĐẠT · CHỜ ĐIỀU KIỆN" tone="accent" body="scroll">
          <PanelSkeleton
            rows={8}
            columns={[44, 96, 140, 52, 40, 130]}
            dense
            label="Đang tải bảng suýt đạt"
          />
        </Panel>
      </div>

      <div className="f1__grip" />

      <div className="f1__rail-right" style={{ width: RAIL_DEFAULT }}>
        <Panel title="VNINDEX · 30 PHIÊN" tone="floor" body="pad">
          <PanelSkeleton rows={3} columns={[120, 60]} label="Đang tải VNINDEX" />
        </Panel>
        <Panel title="PHỄU BỘ QUÉT" tone="ceil" body="pad">
          <PanelSkeleton rows={5} columns={[130, 44]} dense label="Đang tải phễu bộ quét" />
        </Panel>
        <Panel title="KẾ HOẠCH PHIÊN MAI" tone="up" body="none">
          <PanelSkeleton rows={4} columns={[15, 160]} label="Đang tải kế hoạch phiên mai" />
        </Panel>
        <Panel title="DANH MỤC THEO DÕI" tone="floor" body="none">
          <PanelSkeleton rows={8} columns={[40, 62, 48, 44]} dense label="Đang tải danh mục theo dõi" />
        </Panel>
      </div>
    </div>
  );
}
