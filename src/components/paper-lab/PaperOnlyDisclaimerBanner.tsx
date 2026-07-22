"use client";

import "./paper-lab-workstation.css";

export function PaperOnlyDisclaimerBanner() {
  return (
    <div className="paper-lab-disclaimer" data-testid="paper-lab-disclaimer">
      <span className="paper-lab-disclaimer__badge">Chỉ mô phỏng</span>
      <p>
        <strong>Đấu trường là mô phỏng — không dùng vốn thật.</strong> Các agent cạnh tranh
        trên cùng dữ liệu thị trường. Toàn bộ danh mục, lệnh và P&amp;L đều được mô phỏng chỉ
        phục vụ nghiên cứu và đánh giá agent. Không có lệnh nào trên trang này được thực thi thật.
      </p>
    </div>
  );
}
