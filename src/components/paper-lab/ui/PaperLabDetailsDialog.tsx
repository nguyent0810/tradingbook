"use client";

import { useCallback, useRef, type ReactNode } from "react";
import "../paper-lab-workstation.css";

export function PaperLabDetailsDialog({
  title,
  triggerLabel = "View details",
  children,
  testId,
}: {
  title: string;
  triggerLabel?: string;
  children: ReactNode;
  testId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  return (
    <>
      <button type="button" className="paper-lab-json-btn" onClick={open} data-testid={testId}>
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="paper-lab-details-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="paper-lab-details-dialog__header">
          <strong>{title}</strong>
          <button type="button" className="paper-lab-json-btn" onClick={close}>
            Close
          </button>
        </div>
        <div className="paper-lab-details-dialog__body">{children}</div>
      </dialog>
    </>
  );
}
