"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import "../paper-lab-workstation.css";

export function PaperLabSideDrawer({
  open,
  title,
  onClose,
  children,
  testId,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="paper-lab-side-drawer"
      data-testid={testId}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div className="paper-lab-side-drawer__panel">
        <header className="paper-lab-side-drawer__header">
          <strong>{title}</strong>
          <button type="button" className="paper-lab-json-btn" onClick={handleClose} aria-label="Đóng">
            Đóng
          </button>
        </header>
        <div className="paper-lab-side-drawer__body">{children}</div>
      </div>
    </dialog>
  );
}
