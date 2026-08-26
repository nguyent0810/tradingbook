"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type SortDirection = 1 | -1;

export type TableSort<K extends string> = {
  key: K;
  direction: SortDirection;
  /** Đổi cột sắp xếp; click lại cùng cột thì đảo hướng. */
  toggle: (key: K) => void;
  /** Mũi tên hướng cho tiêu đề cột (rỗng nếu không phải cột đang sắp xếp). */
  indicator: (key: K) => string;
  /** `aria-sort` cho `<th>`. */
  ariaSort: (key: K) => "ascending" | "descending" | "none";
  sortRows: <T>(rows: readonly T[], value: (row: T, key: K) => string | number | null | undefined) => T[];
};

/**
 * Sắp xếp bảng phía client. Mặc định giảm dần (giá trị tốt nhất lên đầu),
 * click lại cùng tiêu đề để đảo hướng — khớp bản thiết kế.
 */
export function useTableSort<K extends string>(initialKey: K): TableSort<K> {
  // Một state duy nhất: cập nhật cột và hướng phải nguyên tử, nếu tách đôi thì
  // updater của state này sẽ phải gọi setState của state kia (không an toàn).
  const [{ key, direction }, setSort] = useState<{ key: K; direction: SortDirection }>({
    key: initialKey,
    direction: -1,
  });

  const toggle = useCallback((next: K) => {
    setSort((current) =>
      current.key === next
        ? { key: next, direction: (-current.direction) as SortDirection }
        : { key: next, direction: -1 }
    );
  }, []);

  const indicator = useCallback(
    (candidate: K) => (candidate === key ? (direction < 0 ? "▼" : "▲") : ""),
    [key, direction]
  );

  const ariaSort = useCallback(
    (candidate: K): "ascending" | "descending" | "none" =>
      candidate === key ? (direction < 0 ? "descending" : "ascending") : "none",
    [key, direction]
  );

  const sortRows = useCallback(
    <T,>(rows: readonly T[], value: (row: T, k: K) => string | number | null | undefined): T[] => {
      return rows.slice().sort((a, b) => {
        const av = value(a, key);
        const bv = value(b, key);
        // Ô thiếu dữ liệu luôn xuống cuối, bất kể hướng sắp xếp.
        const aGap = av === null || av === undefined || (typeof av === "number" && !Number.isFinite(av));
        const bGap = bv === null || bv === undefined || (typeof bv === "number" && !Number.isFinite(bv));
        if (aGap && bGap) return 0;
        if (aGap) return 1;
        if (bGap) return -1;
        if (typeof av === "string" || typeof bv === "string") {
          return String(av).localeCompare(String(bv), "vi") * direction;
        }
        return ((av as number) - (bv as number)) * direction;
      });
    },
    [key, direction]
  );

  return useMemo(
    () => ({ key, direction, toggle, indicator, ariaSort, sortRows }),
    [key, direction, toggle, indicator, ariaSort, sortRows]
  );
}

/** Tiêu đề cột sắp xếp được — click đổi sắp xếp và hiện mũi tên hướng (QA §9). */
export function SortTh<K extends string>({
  sort,
  columnKey,
  children,
  numeric = false,
  width,
}: {
  sort: TableSort<K>;
  columnKey: K;
  children: ReactNode;
  numeric?: boolean;
  width?: number | string;
}) {
  return (
    <th
      className={numeric ? "tm-t-num" : undefined}
      aria-sort={sort.ariaSort(columnKey)}
      style={width ? { width } : undefined}
    >
      <button type="button" className="tm-th-sort" onClick={() => sort.toggle(columnKey)}>
        <span>{children}</span>
        <span className="tm-th-sort__ind" aria-hidden="true">
          {sort.indicator(columnKey)}
        </span>
      </button>
    </th>
  );
}
