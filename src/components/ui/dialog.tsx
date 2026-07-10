"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
};

/**
 * Native <dialog>-backed modal — real focus trapping and Escape-to-close
 * for free, same pattern proven in paper-lab/ui/PaperLabDetailsDialog.tsx.
 */
export function Dialog({ open, onClose, title, children, testId }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      data-testid={testId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="dialog__header">
        <strong className="dialog__title">{title}</strong>
        <button type="button" className="dialog__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="dialog__body">{children}</div>
    </dialog>
  );
}
