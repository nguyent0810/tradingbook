import type { ReactNode } from "react";

type Variant = "pass" | "caution" | "blocked";

type Props = {
  variant: Variant;
  children: ReactNode;
};

export function StatusPill({ variant, children }: Props) {
  return (
    <span className={`ccd-status-pill ccd-status-pill--${variant}`}>
      <span className="ccd-status-pill__dot" aria-hidden />
      {children}
    </span>
  );
}
