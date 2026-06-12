import type { ReactNode } from "react";

type Variant = "pass" | "caution" | "blocked";

type Props = {
  variant: Variant;
  children: ReactNode;
};

/** Subtle row status — dot indicator + low-contrast label (no neon pills). */
export function StatusPill({ variant, children }: Props) {
  return (
    <span className={`ccd-status ccd-status--${variant}`}>
      <span className="ccd-status__dot" aria-hidden />
      <span className="ccd-status__label">{children}</span>
    </span>
  );
}
