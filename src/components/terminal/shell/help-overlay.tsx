"use client";

import { useEffect, useRef } from "react";
import { helpRows } from "./use-command-router";

/** Bảng lệnh & phím tắt (F9). ESC đóng — do `useCommandRouter` xử lý. */
export function HelpOverlay({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const rows = helpRows();

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="tm-overlay tm-overlay--center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tm-modal tm-help" role="dialog" aria-modal="true" aria-label="Bảng lệnh và phím tắt">
        <div className="tm-modal__head">
          <span className="tm-panel__rule" style={{ background: "var(--tm-accent)" }} />
          <span className="tm-panel__title">BẢNG LỆNH &amp; PHÍM TẮT</span>
          <span className="tm-panel__spacer" />
          <button ref={closeRef} type="button" className="tm-btn tm-btn--ghost tm-btn--sm" onClick={onClose}>
            ESC ✕
          </button>
        </div>
        <div className="tm-help__grid">
          {rows.map((row) => (
            <div key={`${row.key}-${row.description}`} className="tm-help__row">
              <span className="tm-help__k">{row.key}</span>
              <span className="tm-help__v">{row.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
