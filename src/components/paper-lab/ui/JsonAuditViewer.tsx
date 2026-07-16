"use client";

import { useCallback, useRef } from "react";
import "../paper-lab-workstation.css";

export function JsonAuditViewer({
  payload,
  label = "View JSON",
}: {
  payload: Record<string, unknown> | null;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const copy = useCallback(async () => {
    if (!payload) return;
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }, [payload]);

  if (!payload || Object.keys(payload).length === 0) {
    return <span className="text-[var(--text-tertiary)]">—</span>;
  }

  return (
    <>
      <button type="button" className="paper-lab-json-btn" onClick={open}>
        {label}
      </button>
      <dialog ref={dialogRef} className="paper-lab-json-dialog">
        <div className="paper-lab-json-dialog__header">
          <strong>Decision payload (audit)</strong>
          <div className="flex gap-2">
            <button type="button" className="paper-lab-json-btn" onClick={copy}>
              Copy
            </button>
            <button
              type="button"
              className="paper-lab-json-btn"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
          </div>
        </div>
        <pre className="paper-lab-json-dialog__body">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </dialog>
    </>
  );
}
