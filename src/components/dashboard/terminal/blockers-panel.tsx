import Link from "next/link";
import { EmptyState, Panel } from "@/components/terminal";
import { fmtNum } from "@/lib/format/vn";
import type { F1BlockerRow } from "@/lib/dashboard/terminal/f1-view-model";

/** Yếu tố chặn — vì sao hôm nay không vào lệnh được như bình thường. */
export function BlockersPanel({
  blockers,
  emptyReason,
}: {
  blockers: F1BlockerRow[];
  emptyReason: string | null;
}) {
  return (
    <Panel
      title="YẾU TỐ CHẶN"
      tone="down"
      trailing={
        <span
          className="tm-mono"
          style={{ fontSize: 10, fontWeight: 600, color: "var(--tm-down)" }}
        >
          {blockers.length > 0 ? fmtNum(blockers.length, 0).padStart(2, "0") : "00"}
        </span>
      }
      body={blockers.length > 0 ? "none" : "pad"}
    >
      {blockers.length > 0 ? (
        <div>
          {blockers.map((b) => (
            <div key={`${b.tag}-${b.title}`} className="f1-blocker">
              <span className="f1-blocker__rule" style={{ background: b.color }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="f1-blocker__head">
                  <span className="f1-blocker__tag" style={{ color: b.color }}>
                    {b.tag}
                  </span>
                  <span className="f1-blocker__title">{b.title}</span>
                </div>
                <div className="f1-blocker__note">{b.note}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="∅"
          tone="var(--tm-up)"
          title="Không có yếu tố chặn"
          note={
            emptyReason ??
            "Lần quét gần nhất không ghi nhận nhóm loại nào đủ lớn để chặn kế hoạch phiên."
          }
          action={
            <Link href="/setups" className="tm-btn tm-btn--sm">
              XEM ĐƯỜNG ỐNG
            </Link>
          }
        />
      )}
    </Panel>
  );
}
