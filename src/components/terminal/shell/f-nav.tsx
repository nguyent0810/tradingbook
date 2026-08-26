"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SYMBOL_SCREEN_KEY, TERMINAL_SCREENS, findScreenByPath } from "@/lib/terminal/nav";

/**
 * Nav phím F 29px. Nhãn phím nằm ngay trên tab để phím tắt và chuột chỉ về
 * cùng một chỗ — người dùng học phím bằng cách nhìn nav.
 */
export function FNav({
  onToggleHelp,
  onOpenSymbol,
}: {
  onToggleHelp: () => void;
  onOpenSymbol: () => void;
}) {
  const pathname = usePathname() ?? "";
  const active = findScreenByPath(pathname);

  return (
    <nav className="tm-fnav" aria-label="Chuyển màn">
      {TERMINAL_SCREENS.filter((s) => s.inNav).map((screen) => {
        const current = active?.key === screen.key ? ("page" as const) : undefined;

        // F7 cần một mã cụ thể mới mở được nên là nút, không phải liên kết tới
        // một đường dẫn cố định (`/symbol` không có trang).
        if (screen.key === SYMBOL_SCREEN_KEY) {
          return (
            <button
              key={screen.key}
              type="button"
              className="tm-fnav__item"
              aria-current={current}
              onClick={onOpenSymbol}
            >
              <span className="tm-fnav__key">{screen.key}</span>
              <span>{screen.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={screen.key}
            href={screen.href}
            className="tm-fnav__item"
            aria-current={current}
          >
            <span className="tm-fnav__key">{screen.key}</span>
            <span>{screen.label}</span>
          </Link>
        );
      })}
      <span className="tm-fnav__fill" />
      <button
        type="button"
        className="tm-fnav__item tm-fnav__item--help"
        onClick={onToggleHelp}
        aria-haspopup="dialog"
      >
        <span className="tm-fnav__key">F9</span>
        <span>TRỢ GIÚP</span>
      </button>
    </nav>
  );
}
