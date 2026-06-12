"use client";

import { useEffect, useRef, useState } from "react";
import type { FlashTextProps } from "./types";
import "./trades-workstation.css";

export function FlashText({ value, className = "", children }: FlashTextProps) {
  const prev = useRef<string | number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prev.current === null) {
      prev.current = value;
      return;
    }
    if (prev.current === value) return;

    const prevNum = Number(prev.current);
    const nextNum = Number(value);
    if (Number.isFinite(prevNum) && Number.isFinite(nextNum)) {
      setFlash(nextNum > prevNum ? "up" : "down");
      const t = window.setTimeout(() => setFlash(null), 700);
      prev.current = value;
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  const flashClass =
    flash === "up" ? "tw-flash--up" : flash === "down" ? "tw-flash--down" : "";

  return (
    <span className={`font-mono tabular-nums ${flashClass} ${className}`.trim()}>
      {children ?? value}
    </span>
  );
}
