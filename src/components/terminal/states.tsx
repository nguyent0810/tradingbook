import type { ReactNode } from "react";

/**
 * Bốn trạng thái bắt buộc cho mỗi panel dữ liệu (bàn giao §6):
 * đang tải · rỗng · lỗi kèm bằng chứng · dữ liệu cũ.
 */

/**
 * Skeleton giữ đúng chiều cao hàng thật để layout không nhảy. Không spinner.
 * `columns` là bề rộng tương đối của từng cột giả.
 */
export function PanelSkeleton({
  rows = 5,
  columns = [72, 40, 56, 56, 120],
  dense = false,
  label = "Đang tải dữ liệu",
}: {
  rows?: number;
  columns?: number[];
  dense?: boolean;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={`tm-skel-row${dense ? " tm-skel-row--sm" : ""}`}>
          {columns.map((w, c) => (
            <span
              key={c}
              className="tm-skel-bar"
              style={{ width: w, animationDelay: `${(r * columns.length + c) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export type EmptyStateProps = {
  /** Icon mono một ký tự (◴ ∅ ▤ ◇). Không dùng emoji, không icon minh hoạ. */
  icon: string;
  title: string;
  /** Lý do cụ thể kèm con số thật — không dùng câu chung chung. */
  note: string;
  tone?: string;
  /**
   * Bắt buộc: trạng thái rỗng luôn phải chỉ ra một hành động kế tiếp
   * (bàn giao §6). Kiểu bắt buộc để không panel nào lỡ bỏ quên.
   */
  action: ReactNode;
};

export function EmptyState({ icon, title, note, tone, action }: EmptyStateProps) {
  return (
    <div className="tm-state" style={tone ? ({ "--tm-state-tone": tone } as React.CSSProperties) : undefined}>
      <span className="tm-state__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="tm-state__title">{title}</span>
      <p className="tm-state__note">{note}</p>
      {action}
    </div>
  );
}

export type ErrorStateProps = {
  title: string;
  note: string;
  /** Đường dẫn file / truy vấn thất bại — bằng chứng thật, không thông báo chung. */
  evidence: string;
  action?: ReactNode;
};

/** Lỗi luôn kèm bằng chứng trong khối mono + hành động tải lại. */
export function ErrorState({ title, note, evidence, action }: ErrorStateProps) {
  return (
    <div className="tm-state" role="alert" style={{ ["--tm-state-tone" as string]: "var(--tm-down)" }}>
      <span className="tm-state__icon" aria-hidden="true">
        ✕
      </span>
      <span className="tm-state__title">{title}</span>
      <p className="tm-state__note">{note}</p>
      <pre className="tm-evidence">{evidence.trim()}</pre>
      {action}
    </div>
  );
}

/**
 * Banner dữ liệu cũ — nêu rõ đang xem phiên nào **và** hệ quả
 * (phán quyết + định cỡ tính trên dữ liệu cũ).
 */
export function StaleBanner({
  sessionLabel,
  consequence,
  action,
}: {
  sessionLabel: string;
  consequence: string;
  action?: ReactNode;
}) {
  return (
    <div className="tm-stale" role="status">
      <span className="tm-stale__tag">DỮ LIỆU CŨ</span>
      <span>
        Đang xem phiên <strong>{sessionLabel}</strong>. {consequence}
      </span>
      <span className="tm-panel__spacer" />
      {action}
    </div>
  );
}
