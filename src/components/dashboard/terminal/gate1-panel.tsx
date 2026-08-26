import { Panel } from "@/components/terminal";
import type { F1Gate1Row } from "@/lib/dashboard/terminal/f1-view-model";

/**
 * Cổng 1 · chế độ thị trường.
 * Khi bản trực tiếp xấu hơn bản đã lưu, panel hiện **cả hai** giá trị và ghi rõ
 * nguồn chuẩn là trực tiếp (QA §5) — không giấu bản đã lưu, cũng không tin nó.
 */
export function Gate1Panel({ rows, note }: { rows: F1Gate1Row[]; note: string }) {
  return (
    <Panel title="CỔNG 1 · CHẾ ĐỘ THỊ TRƯỜNG" tone="accent" body="pad">
      {rows.map((row) => (
        <div key={row.key} className="f1-gate1__row">
          <span className="f1-gate1__k">{row.key}</span>
          <span className="f1-gate1__v" style={{ color: row.color }}>
            {row.value}
          </span>
        </div>
      ))}
      <div className="tm-note" style={{ marginTop: 7 }}>
        {note}
      </div>
    </Panel>
  );
}
