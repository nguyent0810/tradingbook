import type { ReactNode } from "react";
import {
  GAP,
  fmtNum,
  fmtPctSigned,
  fmtSigned,
  priceToneClass,
} from "@/lib/format/vn";
import type { DataProvenance } from "@/lib/dashboard/decision-cockpit-dto";

/**
 * Số hiển thị: IBM Plex Mono + tabular-nums + căn phải (bàn giao §1).
 * Ô thiếu dữ liệu hiện `—`, không hiện 0.
 */
export function Num({
  value,
  digits = 0,
  tone,
  className = "",
  title,
}: {
  value: number | null | undefined;
  digits?: number;
  /** Ghi đè màu; mặc định theo màu chữ hiện tại. */
  tone?: string;
  className?: string;
  title?: string;
}) {
  const text = fmtNum(value, digits);
  return (
    <span
      className={`tm-num${text === GAP ? " tm-gap" : ""}${className ? ` ${className}` : ""}`}
      style={tone && text !== GAP ? { color: tone } : undefined}
      title={title}
    >
      {text}
    </span>
  );
}

/**
 * Biến động có dấu, tô màu theo quy ước bảng giá VN:
 * xanh tăng · đỏ giảm · vàng tham chiếu. Không đảo ngược.
 */
export function Delta({
  value,
  digits = 2,
  suffix = "%",
  className = "",
}: {
  value: number | null | undefined;
  digits?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={`tm-num ${priceToneClass(value)}${className ? ` ${className}` : ""}`}>
      {suffix === "%" && digits === 2 ? fmtPctSigned(value, digits) : fmtSigned(value, digits, suffix)}
    </span>
  );
}

/** Ô thiếu dữ liệu tường minh — dùng khi giá trị không tồn tại, không phải bằng 0. */
export function Gap({ label = GAP }: { label?: string }) {
  return <span className="tm-num tm-gap">{label}</span>;
}

const PROVENANCE_LABEL: Record<DataProvenance, string> = {
  real: "real",
  derived: "derived",
  static_copy: "static",
  config: "config",
  gap: "gap",
};

/**
 * Nhãn nguồn dữ liệu cạnh giá trị (QA §5).
 * Ô mang nhãn `gap` không được dùng để tính phán quyết.
 */
export function SourceTag({ provenance }: { provenance: DataProvenance }) {
  const label = PROVENANCE_LABEL[provenance] ?? provenance;
  return (
    <span
      className="tm-src"
      data-src={label}
      title={`Nguồn dữ liệu: ${label}`}
    >
      {label}
    </span>
  );
}

/** Nhãn chữ nhỏ dạng chip (hạng A/B, trạng thái). */
export function Tag({
  children,
  tone,
  solid = false,
  title,
}: {
  children: ReactNode;
  tone?: string;
  solid?: boolean;
  title?: string;
}) {
  return (
    <span
      className={`tm-tag${solid ? " tm-tag--solid" : ""}`}
      style={
        solid
          ? ({ "--tm-tag-tone": tone } as React.CSSProperties)
          : tone
            ? { color: tone }
            : undefined
      }
      title={title}
    >
      {children}
    </span>
  );
}

/** Thanh mức mảnh (sức khoẻ thiết lập, phễu bộ quét). */
export function Meter({
  pct,
  tone,
  width = 34,
}: {
  pct: number | null | undefined;
  tone: string;
  width?: number;
}) {
  const clamped = Number.isFinite(pct ?? NaN) ? Math.max(0, Math.min(100, pct as number)) : 0;
  return (
    <span
      className="tm-meter"
      style={{ width, ["--tm-meter-tone" as string]: tone }}
      role="presentation"
    >
      <span style={{ width: `${clamped}%` }} />
    </span>
  );
}
