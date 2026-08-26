"use client";

import { EmptyState, Meter, Panel, SortTh, Sparkline, Tag, useTableSort } from "@/components/terminal";
import {
  GAP,
  fmtNum,
  fmtPctSigned,
  priceToneClass,
  priceToneVar,
  semanticTone,
} from "@/lib/format/vn";
import type { F1SetupRow } from "@/lib/dashboard/terminal/f1-view-model";

type SortKey = "symbol" | "rankScore" | "close" | "rs20" | "healthScore";

function zoneLabel(low: number | null, high: number | null): string {
  if (low == null || high == null) return GAP;
  return `${fmtNum(low, 2)}–${fmtNum(high, 2)}`;
}

/**
 * Bảng thiết lập Hạng A/B — bảng chính của F1.
 * thead dính, click tiêu đề để sắp xếp, hàng đang chọn có viền trái 2px amber.
 */
export function SetupsTable({
  rows,
  emptyReason,
  selected,
  onSelect,
  scanRunId,
}: {
  rows: F1SetupRow[];
  emptyReason: string | null;
  selected: string | null;
  onSelect: (symbol: string) => void;
  scanRunId: string | null;
}) {
  const sort = useTableSort<SortKey>("rankScore");

  const sorted = sort.sortRows(rows, (row, key) => {
    switch (key) {
      case "symbol":
        return row.symbol;
      case "rankScore":
        return row.rankScore;
      case "close":
        return row.close;
      case "rs20":
        return row.rs20;
      case "healthScore":
        return row.healthScore;
    }
  });

  const tierACount = rows.filter((r) => r.tier === "A").length;

  return (
    <Panel
      className="f1__setups"
      title="THIẾT LẬP HẠNG A/B"
      tone="up"
      meta={
        rows.length > 0
          ? `· ${fmtNum(rows.length, 0)} MÃ · ${fmtNum(tierACount, 0)} HẠNG A · GIÁ THEO NGHÌN ₫`
          : undefined
      }
      trailing={
        rows.length > 0 ? (
          <span
            className="tm-mono"
            style={{ fontSize: 9, letterSpacing: ".06em", color: "var(--tm-text-dim)" }}
          >
            CLICK TIÊU ĐỀ ĐỂ SẮP XẾP
          </span>
        ) : undefined
      }
      body={rows.length > 0 ? "scroll" : "pad"}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="∅"
          tone="var(--tm-accent)"
          title="Không có ứng viên đạt Cổng 2"
          note={
            emptyReason ??
            "Lần quét gần nhất không đưa mã nào qua đủ tiêu chí Cổng 2. Xem bảng suýt đạt bên dưới để biết vướng ở đâu."
          }
          action={
            <span className="tm-mono" style={{ fontSize: 10, color: "var(--tm-text-faint)" }}>
              {scanRunId ? `LẦN QUÉT ${scanRunId}` : "CHƯA CÓ LẦN QUÉT NÀO"}
            </span>
          }
        />
      ) : (
        <table className="tm-table">
          <thead>
            <tr>
              <SortTh sort={sort} columnKey="symbol">
                MÃ
              </SortTh>
              <th>HẠNG</th>
              <SortTh sort={sort} columnKey="rankScore" numeric>
                ĐIỂM
              </SortTh>
              <SortTh sort={sort} columnKey="close" numeric>
                GIÁ
              </SortTh>
              <th className="tm-t-num">+/-</th>
              <th className="tm-t-num">VÙNG MUA</th>
              <th className="tm-t-num">CẮT LỖ</th>
              <SortTh sort={sort} columnKey="rs20" numeric>
                RS20
              </SortTh>
              <SortTh sort={sort} columnKey="healthScore">
                SỨC KHOẺ
              </SortTh>
              <th className="tm-t-spark">20N</th>
              <th>HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.symbol}
                className="tm-row-pick"
                data-selected={selected === row.symbol}
                aria-selected={selected === row.symbol}
                tabIndex={0}
                onClick={() => onSelect(row.symbol)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row.symbol);
                  }
                }}
              >
                <td className="tm-t-sym">{row.symbol}</td>
                <td>
                  <Tag
                    tone={row.tier === "A" ? "var(--tm-up)" : undefined}
                    solid={row.tier === "A"}
                  >
                    {row.tier}
                  </Tag>
                </td>
                <td className="tm-t-num" style={{ fontWeight: 600, color: "var(--tm-text-value)" }}>
                  {fmtNum(row.rankScore, 1)}
                </td>
                <td className="tm-t-num" style={{ color: "var(--tm-text-value)" }}>
                  {fmtNum(row.close, 2)}
                </td>
                <td className={`tm-t-num ${priceToneClass(row.changePct)}`}>
                  {fmtPctSigned(row.changePct)}
                </td>
                <td className="tm-t-num" style={{ fontSize: 11, color: "var(--tm-text-mute)" }}>
                  {zoneLabel(row.zoneLow, row.zoneHigh)}
                </td>
                <td
                  className="tm-t-num"
                  style={{ fontSize: 11, color: semanticTone(row.stop, "var(--tm-down-soft)") }}
                >
                  {fmtNum(row.stop, 2)}
                </td>
                <td className="tm-t-num" style={{ color: row.rsColor }}>
                  {fmtPctSigned(row.rs20, 1)}
                </td>
                <td>
                  <span className="f1-health">
                    <Meter pct={row.healthScore} tone={row.healthColor} />
                    <span className="f1-health__label" style={{ color: row.healthColor }}>
                      {row.healthLabel} {fmtNum(row.healthScore, 0)}
                    </span>
                  </span>
                </td>
                <td className="tm-t-spark">
                  <Sparkline
                    values={row.spark}
                    tone={priceToneVar(row.changePct)}
                    label={`${row.symbol} 20 phiên`}
                  />
                </td>
                <td style={{ fontSize: 11, color: "var(--tm-text-mute)", whiteSpace: "nowrap" }}>
                  {row.actionHint}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
