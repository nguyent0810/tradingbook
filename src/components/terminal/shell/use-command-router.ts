"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SYMBOL_SCREEN_KEY,
  TERMINAL_SCREENS,
  findScreenByKey,
  resolveCommand,
  symbolFromPath,
  symbolHref,
} from "@/lib/terminal/nav";

export type CommandEcho = {
  message: string;
  kind: "idle" | "ok" | "error";
};

const IDLE: CommandEcho = { message: "SẴN SÀNG", kind: "idle" };

/** Phím chức năng hợp lệ: F1…F9. */
const FUNCTION_KEY = /^F([1-9])$/;

export type CommandRouter = {
  echo: CommandEcho;
  helpOpen: boolean;
  toggleHelp: () => void;
  closeHelp: () => void;
  runCommand: (raw: string) => void;
  /** Mở màn chi tiết mã đang chọn; báo lỗi nếu chưa chọn mã nào. */
  openSymbolScreen: () => void;
};

/**
 * Mã đang xem gần nhất, giữ trong `sessionStorage`.
 *
 * Phím F7 mở "chi tiết mã đang chọn" nên phải có một mã để mở. Không có thì
 * báo ở dòng lệnh chứ không nhảy tới một đường dẫn không tồn tại.
 */
const LAST_SYMBOL_KEY = "tradelog.terminal.lastSymbol";

function rememberSymbol(symbol: string): void {
  try {
    window.sessionStorage.setItem(LAST_SYMBOL_KEY, symbol);
  } catch {
    // Chế độ riêng tư có thể chặn ghi — phím F7 chỉ mất trí nhớ giữa các lần tải.
  }
}

function recallSymbol(): string | null {
  try {
    return window.sessionStorage.getItem(LAST_SYMBOL_KEY);
  } catch {
    return null;
  }
}

/**
 * Bộ điều phối bàn phím + dòng lệnh của shell.
 *
 * F1–F8 chuyển màn · F9 bật/tắt trợ giúp · ESC đóng lớp phủ (QA §6).
 * F7 cần một mã đang chọn nên xử lý riêng qua `openSymbolScreen()`.
 * `preventDefault` để phím F không bị trình duyệt chiếm.
 */
export function useCommandRouter(): CommandRouter {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [echo, setEcho] = useState<CommandEcho>(IDLE);
  const [helpOpen, setHelpOpen] = useState(false);

  // Ghi nhớ mã ngay khi người dùng đang đứng ở màn chi tiết mã.
  const currentSymbol = symbolFromPath(pathname);
  useEffect(() => {
    if (currentSymbol) rememberSymbol(currentSymbol);
  }, [currentSymbol]);

  const openSymbolScreen = useCallback(() => {
    const symbol = currentSymbol ?? recallSymbol();
    if (!symbol) {
      setEcho({
        message: "CHƯA CHỌN MÃ — GÕ MÃ Ở DÒNG LỆNH TRƯỚC",
        kind: "error",
      });
      return;
    }
    setHelpOpen(false);
    setEcho({ message: `MÃ ${symbol}`, kind: "ok" });
    router.push(symbolHref(symbol));
  }, [currentSymbol, router]);

  const toggleHelp = useCallback(() => setHelpOpen((open) => !open), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const goToScreen = useCallback(
    (key: string) => {
      if (key === SYMBOL_SCREEN_KEY) {
        openSymbolScreen();
        return true;
      }
      const screen = findScreenByKey(key);
      if (!screen) return false;
      setHelpOpen(false);
      setEcho({ message: `→ ${screen.label}`, kind: "ok" });
      router.push(screen.href);
      return true;
    },
    [router, openSymbolScreen]
  );

  const runCommand = useCallback(
    (raw: string) => {
      const result = resolveCommand(raw);
      switch (result.kind) {
        case "empty":
          return;
        case "help":
          setHelpOpen(true);
          setEcho({ message: "MỞ TRỢ GIÚP", kind: "ok" });
          return;
        case "screen":
          if (result.screen.key === SYMBOL_SCREEN_KEY) {
            openSymbolScreen();
            return;
          }
          setHelpOpen(false);
          setEcho({ message: `→ ${result.screen.label}`, kind: "ok" });
          router.push(result.screen.href);
          return;
        case "symbol":
          setHelpOpen(false);
          rememberSymbol(result.symbol);
          setEcho({ message: `MÃ ${result.symbol}`, kind: "ok" });
          router.push(result.href);
          return;
        case "unknown":
          setEcho({ message: `LỆNH KHÔNG HỢP LỆ: ${result.input}`, kind: "error" });
      }
    },
    [router, openSymbolScreen]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHelpOpen(false);
        return;
      }

      // Tổ hợp có modifier thuộc về trình duyệt / hệ điều hành, không chiếm.
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const match = FUNCTION_KEY.exec(event.key);
      if (!match) return;

      if (match[1] === "9") {
        event.preventDefault();
        toggleHelp();
        return;
      }
      if (goToScreen(`F${match[1]}`)) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToScreen, toggleHelp]);

  return useMemo(
    () => ({ echo, helpOpen, toggleHelp, closeHelp, runCommand, openSymbolScreen }),
    [echo, helpOpen, toggleHelp, closeHelp, runCommand, openSymbolScreen]
  );
}

export type HelpRow = { key: string; description: string };

/**
 * Các dòng của bảng trợ giúp F9 — dựng từ cùng bản đồ màn với nav và phím tắt,
 * nên ba nơi này không thể lệch nhau.
 */
export function helpRows(): HelpRow[] {
  return [
    ...TERMINAL_SCREENS.map((s) => ({ key: s.key, description: s.help })),
    { key: "F9", description: "Bật/tắt bảng trợ giúp này" },
    { key: "ESC", description: "Đóng lớp phủ" },
    ...TERMINAL_SCREENS.map((s) => ({
      key: s.commands[0],
      description: `Lệnh: mở ${s.label.toLowerCase()}`,
    })),
    { key: "<MÃ>", description: "Nhập mã 3–4 ký tự (VD: FPT) để mở chi tiết" },
    { key: "HELP · ?", description: "Mở bảng lệnh" },
  ];
}
