"use client";

import { useEffect, useRef } from "react";
import { SourceTag } from "@/components/terminal";
import type { F1EvidenceRow } from "@/lib/dashboard/terminal/f1-view-model";

/**
 * Drawer phải · bằng chứng phán quyết.
 *
 * Mỗi dòng mang nhãn nguồn dữ liệu; chân trang ghi rõ lần quét nào và quy tắc
 * lấy giá trị xấu hơn — để người đọc truy được phán quyết về tới số gốc.
 */
export function EvidenceDrawer({
  rows,
  scanRunId,
  gate1Note,
  onClose,
}: {
  rows: F1EvidenceRow[];
  scanRunId: string | null;
  gate1Note: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="tm-overlay tm-overlay--right"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tm-modal tm-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Bằng chứng phán quyết"
      >
        <div className="tm-modal__head">
          <span className="tm-panel__rule" style={{ background: "var(--tm-accent)" }} />
          <span className="tm-panel__title">BẰNG CHỨNG PHÁN QUYẾT</span>
          <span className="tm-panel__meta">· {rows.length} DÒNG</span>
          <span className="tm-panel__spacer" />
          <button
            ref={closeRef}
            type="button"
            className="tm-btn tm-btn--ghost tm-btn--sm"
            onClick={onClose}
          >
            ESC ✕
          </button>
        </div>

        <div className="tm-modal__body">
          {rows.map((row) => (
            <div key={row.id} className="f1-evidence__row">
              <div className="f1-evidence__label">
                {row.label}
                {row.hint ? <div className="f1-evidence__hint">{row.hint}</div> : null}
              </div>
              <div className="f1-evidence__value">
                <span className="f1-evidence__display">{row.display}</span>
                <SourceTag provenance={row.provenance} />
              </div>
            </div>
          ))}
        </div>

        <div className="f1-evidence__foot">
          <div>LẦN QUÉT · {scanRunId ?? "—"}</div>
          <div>{gate1Note}</div>
        </div>
      </div>
    </div>
  );
}
