"use client";

import type { ReactNode } from "react";
import type { FlashDirection } from "../types";

type Props = {
  flashKey: string;
  flashMap: Record<string, FlashDirection>;
  children: ReactNode;
  className?: string;
};

export function FlashValue({ flashKey, flashMap, children, className = "" }: Props) {
  const direction = flashMap[flashKey];
  const flashClass =
    direction === "up" ? "ccd-flash--up" : direction === "down" ? "ccd-flash--down" : "";

  return (
    <span className={`${flashClass} ${className}`.trim()} data-flash-key={flashKey}>
      {children}
    </span>
  );
}
