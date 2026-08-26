"use client";

import { useCallback, useSyncExternalStore } from "react";

export const RAIL_MIN = 240;
export const RAIL_MAX = 520;
export const RAIL_DEFAULT = 318;

const STORAGE_KEY = "tradelog.terminal.f1.railWidth";
/** Bước khi chỉnh bằng bàn phím — đủ nhỏ để canh, đủ lớn để không phải giữ phím. */
const KEY_STEP = 16;

function clamp(width: number): number {
  return Math.max(RAIL_MIN, Math.min(RAIL_MAX, Math.round(width)));
}

/**
 * Bề rộng cột phải là **state ngoài React**: nó sống trong `localStorage` để
 * giữ nguyên khi chuyển màn (QA §8). Nên đăng ký qua `useSyncExternalStore`
 * thay vì đọc trong `useEffect` rồi `setState` — cách đó gây thêm một vòng
 * render và React khuyến cáo không dùng.
 */
let cached: number | null = null;
const listeners = new Set<() => void>();

function readWidth(): number {
  if (cached !== null) return cached;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    cached = Number.isFinite(parsed) ? clamp(parsed) : RAIL_DEFAULT;
  } catch {
    // Chế độ riêng tư có thể chặn đọc — rơi về mặc định.
    cached = RAIL_DEFAULT;
  }
  return cached;
}

/** Server không biết `localStorage`; hydrate bằng mặc định rồi React tự đồng bộ. */
function serverWidth(): number {
  return RAIL_DEFAULT;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Đổi bề rộng mà chưa ghi đĩa — dùng trong lúc kéo, tránh ghi mỗi khung hình. */
function setLive(next: number): void {
  cached = clamp(next);
  emit();
}

/** Chốt bề rộng và ghi lại để giữ qua các màn. */
function persist(next: number): void {
  cached = clamp(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, String(cached));
  } catch {
    // Ghi bị chặn — bề rộng vẫn đúng trong phiên này.
  }
  emit();
}

export function useRailWidth() {
  const width = useSyncExternalStore(subscribe, readWidth, serverWidth);

  /** Kéo bằng chuột/cảm ứng. Con trỏ đi sang trái ⇒ cột phải rộng ra. */
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;

      const onMove = (e: PointerEvent) => setLive(startWidth - (e.clientX - startX));
      const onUp = (e: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        persist(startWidth - (e.clientX - startX));
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [width]
  );

  /** Mũi tên trái/phải khi vạch đang focus — kéo chuột không phải lối duy nhất. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        persist(width + KEY_STEP);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        persist(width - KEY_STEP);
      } else if (event.key === "Home") {
        event.preventDefault();
        persist(RAIL_DEFAULT);
      }
    },
    [width]
  );

  return { width, onPointerDown, onKeyDown };
}
