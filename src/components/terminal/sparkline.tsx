/**
 * Sparkline 20 phiên trong ô bảng — vạch đơn, không tô nền, không nhãn.
 * Đây là ô duy nhất được phép căn giữa (QA §2).
 */

/**
 * Đường sparkline **giữ nguyên vị trí phiên**: điểm thiếu dữ liệu không bị
 * loại rồi dồn chỉ số lại, mà ngắt đường thành nhiều đoạn. Nếu dồn lại thì
 * chuỗi có gap sẽ vẽ giống hệt chuỗi liền — mắt người đọc không phân biệt được
 * "không có dữ liệu" với "giá đi ngang", đúng lỗi mà quy ước gap cấm.
 *
 * Trả về chuỗi rỗng khi không có đoạn nào vẽ được (dưới 2 điểm liền nhau).
 */
export function sparklinePath(
  values: readonly (number | null | undefined)[],
  width: number,
  height: number
): string {
  const finite = values.filter((v): v is number => Number.isFinite(v ?? Number.NaN));
  if (finite.length < 2 || values.length < 2) return "";

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min || 1;
  const lastIndex = values.length - 1;

  const segments: string[] = [];
  let current: string[] = [];

  const flush = () => {
    // Đoạn một điểm không vẽ được thành đường — bỏ, ô sẽ thưa hơn đúng thực tế.
    if (current.length >= 2) segments.push(current.join(" "));
    current = [];
  };

  values.forEach((value, index) => {
    if (!Number.isFinite(value ?? Number.NaN)) {
      flush();
      return;
    }
    const x = (index / lastIndex) * width;
    const y = height - (((value as number) - min) / range) * (height - 2) - 1;
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  flush();

  return segments.join(" ");
}

export function Sparkline({
  values,
  width = 54,
  height = 16,
  tone,
  label,
}: {
  values: readonly (number | null | undefined)[];
  width?: number;
  height?: number;
  tone: string;
  label?: string;
}) {
  const d = sparklinePath(values, width, height);
  if (!d) return <span className="tm-num tm-gap">—</span>;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      style={{ display: "block", margin: "0 auto" }}
      role={label ? "img" : "presentation"}
      aria-label={label}
    >
      <path d={d} stroke={tone} strokeWidth="1.2" />
    </svg>
  );
}
