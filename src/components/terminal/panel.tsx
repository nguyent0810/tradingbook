import type { CSSProperties, ReactNode } from "react";

export type PanelTone =
  | "accent"
  | "up"
  | "down"
  | "ref"
  | "ceil"
  | "floor"
  | "neutral";

const TONE_VAR: Record<PanelTone, string> = {
  accent: "var(--tm-accent)",
  up: "var(--tm-up)",
  down: "var(--tm-down)",
  ref: "var(--tm-ref)",
  ceil: "var(--tm-ceil)",
  floor: "var(--tm-floor)",
  neutral: "var(--tm-line-input)",
};

export function toneVar(tone: PanelTone): string {
  return TONE_VAR[tone];
}

export type PanelHeadProps = {
  /** Vạch màu 3px làm dấu nhóm — dấu hiệu phân loại duy nhất được phép. */
  tone?: PanelTone;
  /** Ghi đè màu vạch bằng biến CSS cụ thể (ví dụ màu phán quyết). */
  ruleColor?: string;
  title: string;
  /** Chú thích mono ngay sau tiêu đề. */
  meta?: ReactNode;
  /** Nội dung căn phải trong thanh tiêu đề. */
  trailing?: ReactNode;
  /** Nền tiêu đề khác mặc định (panel phán quyết đổi theo mức). */
  background?: string;
};

export function PanelHead({
  tone = "neutral",
  ruleColor,
  title,
  meta,
  trailing,
  background,
}: PanelHeadProps) {
  return (
    <div className="tm-panel__head" style={background ? { background } : undefined}>
      <span className="tm-panel__rule" style={{ background: ruleColor ?? TONE_VAR[tone] }} />
      <span className="tm-panel__title">{title}</span>
      {meta ? <span className="tm-panel__meta">{meta}</span> : null}
      <span className="tm-panel__spacer" />
      {trailing}
    </div>
  );
}

/**
 * Cách bọc thân panel:
 * - `pad`    — đệm 9px (mặc định, dùng cho nội dung tự do)
 * - `scroll` — chiếm phần còn lại và cuộn, không đệm (bảng có thead sticky)
 * - `none`   — trả thẳng children, panel tự lo (danh sách hàng có viền riêng)
 */
export type PanelBodyMode = "pad" | "scroll" | "none";

export type PanelProps = PanelHeadProps & {
  children: ReactNode;
  body?: PanelBodyMode;
  /**
   * Panel nằm trong lưới khe 1px (nền lưới làm đường chia) — bỏ viền riêng.
   * Mặc định `true` vì mọi màn đều dùng lưới khe 1px.
   */
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

/**
 * Khung panel chuẩn: tiêu đề 24px + thân.
 * Phân tách bằng viền 1px và nền khác nhau — không bóng, không gradient.
 */
export function Panel({
  children,
  body = "pad",
  flush = true,
  className = "",
  style,
  "aria-label": ariaLabel,
  ...head
}: PanelProps) {
  return (
    <section
      className={`tm-panel${flush ? " tm-panel--flush" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      aria-label={ariaLabel ?? head.title}
    >
      <PanelHead {...head} />
      {body === "none" ? (
        children
      ) : (
        <div className={body === "scroll" ? "tm-panel__body tm-panel__body--scroll" : "tm-panel__body"}>
          {children}
        </div>
      )}
    </section>
  );
}
