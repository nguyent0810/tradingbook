"use client";

import { useSyncExternalStore } from "react";
import { fmtClock } from "@/lib/format/vn";

const PLACEHOLDER = "--:--:--";

/**
 * Đồng hồ là nguồn bên ngoài React, nên đăng ký qua `useSyncExternalStore`:
 * giá trị chỉ đổi trong callback của `setInterval`, `getSnapshot` luôn trả cùng
 * một chuỗi trong một lần render.
 */
let current = PLACEHOLDER;

function subscribe(onChange: () => void): () => void {
  current = fmtClock(new Date());
  onChange();
  const id = setInterval(() => {
    const next = fmtClock(new Date());
    if (next === current) return;
    current = next;
    onChange();
  }, 1000);
  return () => clearInterval(id);
}

function getSnapshot(): string {
  return current;
}

/**
 * Giờ máy chủ và giờ trình duyệt không bao giờ trùng đến từng giây, nên bản
 * render trên server luôn là chỗ giữ chỗ — giờ thật chỉ xuất hiện sau khi mount.
 */
function getServerSnapshot(): string {
  return PLACEHOLDER;
}

/** Đồng hồ phiên theo giờ Việt Nam (ICT). */
export function TerminalClock() {
  const clock = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <span
      className="tm-mono"
      style={{ color: "var(--tm-text-base)", fontWeight: 600, minWidth: "8ch" }}
    >
      {clock}
    </span>
  );
}
