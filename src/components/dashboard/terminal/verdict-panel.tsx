import Link from "next/link";
import { Panel, SourceTag } from "@/components/terminal";
import type { F1VerdictPanel } from "@/lib/dashboard/terminal/f1-view-model";

/**
 * Panel phán quyết — thứ đầu tiên mắt gặp, góc trên-trái (bàn giao §1).
 * Mức phán quyết chi phối màu vạch, nền tiêu đề, ô phân bổ và nút chính.
 */
export function VerdictPanel({
  verdict,
  onOpenEvidence,
}: {
  verdict: F1VerdictPanel;
  onOpenEvidence: () => void;
}) {
  return (
    <Panel
      title="PHÁN QUYẾT PHIÊN"
      ruleColor={verdict.color}
      background={verdict.headBg}
      trailing={<SourceTag provenance={verdict.provenance} />}
      body="pad"
    >
      <div className="f1-verdict__lead">
        <span className="f1-verdict__code" style={{ background: verdict.color }}>
          {verdict.code}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="f1-verdict__headline">{verdict.headline}</div>
          <div className="f1-verdict__book">SỔ LỆNH: {verdict.bookStance}</div>
        </div>
      </div>

      {verdict.untrusted ? (
        <div className="tm-evidence" style={{ marginBottom: 10 }}>
          {verdict.untrusted.reason}
        </div>
      ) : null}

      <p className="tm-body" style={{ marginBottom: 11 }}>
        {verdict.explanation}
      </p>

      <div className="tm-kpis" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 10 }}>
        <div className="tm-kpi">
          <div className="tm-kpi__k">PHÂN BỔ</div>
          <div className="tm-kpi__v" style={{ color: verdict.color }}>
            {verdict.allocation}
          </div>
        </div>
        <div className="tm-kpi">
          <div className="tm-kpi__k">RỦI RO/LỆNH</div>
          <div className="tm-kpi__v">{verdict.perTrade}</div>
        </div>
      </div>

      <div className="f1-verdict__conf">
        <span className="tm-eyebrow--dim">ĐỘ TIN CẬY</span>
        <span className="f1-verdict__bars">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="f1-verdict__bar"
              style={i < verdict.confidenceBars ? { background: verdict.color } : undefined}
            />
          ))}
        </span>
        <span
          className="tm-mono"
          style={{ fontSize: 10, color: "var(--tm-text-strong)", letterSpacing: ".05em" }}
        >
          {verdict.confidenceLabel}
        </span>
      </div>

      <div className="tm-btn-group">
        {verdict.untrusted ? (
          // Không có phán quyết thì không có kế hoạch để chốt — nút bị vô hiệu
          // thay vì dẫn người dùng đi vào lệnh trên dữ liệu không có.
          <button type="button" className="tm-btn tm-btn--primary" style={{ flex: 1 }} disabled>
            CHỐT KẾ HOẠCH
          </button>
        ) : (
          <Link
            href="/setups"
            className="tm-btn tm-btn--primary"
            style={{ flex: 1, ["--tm-btn-tone" as string]: verdict.color }}
          >
            CHỐT KẾ HOẠCH
          </Link>
        )}
        <button type="button" className="tm-btn" onClick={onOpenEvidence}>
          BẰNG CHỨNG
        </button>
        <Link href="/book" className="tm-btn">
          SỔ LỆNH
        </Link>
      </div>
    </Panel>
  );
}
