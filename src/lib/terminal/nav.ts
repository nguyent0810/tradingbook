/**
 * Bản đồ phím F → màn. Nguồn duy nhất cho nav, phím tắt và bảng trợ giúp —
 * ba nơi này không được lệch nhau.
 */
export type TerminalScreen = {
  /** Phím chức năng, ví dụ "F1". */
  key: string;
  label: string;
  href: string;
  /** Đường dẫn coi là "đang ở màn này" (khớp tiền tố). */
  match: string;
  /** Hiện trên thanh nav của bản chạy thật. */
  inNav: boolean;
  /** Mô tả trong bảng trợ giúp F9. */
  help: string;
  /** Từ khoá gõ ở dòng lệnh để tới màn này. */
  commands: string[];
};

export const TERMINAL_SCREENS: readonly TerminalScreen[] = [
  {
    key: "F1",
    label: "ĐIỀU KHIỂN",
    href: "/dashboard",
    match: "/dashboard",
    inNav: true,
    help: "Bảng điều khiển — phán quyết + thiết lập",
    commands: ["DASH", "DASHBOARD"],
  },
  {
    key: "F2",
    label: "THIẾT LẬP",
    href: "/setups",
    match: "/setups",
    inNav: true,
    help: "Thiết lập & đường ống bộ quét",
    commands: ["SETUP", "SETUPS"],
  },
  {
    key: "F3",
    label: "ĐẤU TRƯỜNG",
    href: "/paper-lab",
    match: "/paper-lab",
    inNav: true,
    help: "Đấu trường mô phỏng",
    commands: ["ARENA", "LAB"],
  },
  {
    key: "F4",
    label: "SỔ LỆNH",
    href: "/book",
    match: "/book",
    inNav: true,
    help: "Sổ lệnh & lịch sử giao dịch",
    commands: ["BOOK"],
  },
  {
    key: "F5",
    label: "CÀI ĐẶT",
    href: "/settings",
    match: "/settings",
    inNav: true,
    help: "Cài đặt tài khoản & rủi ro",
    commands: ["SET", "SETTINGS"],
  },
  {
    // Đang đăng nhập thì /login tự chuyển về /dashboard — phím vẫn giữ để khớp
    // bảng phím trong tài liệu, nhưng không chiếm chỗ trên nav.
    key: "F6",
    label: "PHIÊN",
    href: "/login",
    match: "/login",
    inNav: false,
    help: "Phiên làm việc / đăng nhập",
    commands: ["LOGIN"],
  },
  {
    // Cần một mã cụ thể mới mở được, nên phím F7 không dẫn tới đường dẫn cố định;
    // `SYMBOL_SCREEN_KEY` bên dưới đánh dấu nó để bộ bắt phím xử lý riêng.
    key: "F7",
    label: "CHI TIẾT MÃ",
    href: "/symbol",
    match: "/symbol",
    inNav: true,
    help: "Chi tiết mã đang chọn",
    commands: ["SYM", "SYMBOL"],
  },
  {
    // Trang tham chiếu nội bộ cho DEV/QA — bàn giao §4 yêu cầu KHÔNG đưa vào nav
    // của bản chạy thật, nhưng vẫn giữ phím tắt và lệnh để tra nhanh.
    key: "F8",
    label: "TRẠNG THÁI",
    href: "/states",
    match: "/states",
    inNav: false,
    help: "Trạng thái & token bàn giao (tham chiếu nội bộ)",
    commands: ["STATES"],
  },
];

/** Màn cần một mã cụ thể mới mở được. */
export const SYMBOL_SCREEN_KEY = "F7";

/** Mã cổ phiếu hợp lệ gõ ở dòng lệnh: 3–4 chữ cái. */
export const SYMBOL_COMMAND_PATTERN = /^[A-Z]{3,4}$/;

export function findScreenByKey(key: string): TerminalScreen | undefined {
  return TERMINAL_SCREENS.find((s) => s.key === key);
}

export function findScreenByCommand(command: string): TerminalScreen | undefined {
  const upper = command.toUpperCase();
  return TERMINAL_SCREENS.find((s) => s.commands.includes(upper));
}

/** Màn khớp đường dẫn hiện tại (khớp tiền tố, ưu tiên đoạn dài nhất). */
export function findScreenByPath(pathname: string): TerminalScreen | undefined {
  return TERMINAL_SCREENS.filter(
    (s) => pathname === s.match || pathname.startsWith(`${s.match}/`)
  ).sort((a, b) => b.match.length - a.match.length)[0];
}

/**
 * Đường dẫn màn chi tiết mã (F7). Gom về một chỗ vì cả ô TÌM MÃ trên thanh trên,
 * dòng lệnh và các bảng đều nhảy tới đây.
 */
export function symbolHref(symbol: string): string {
  return `/symbol/${encodeURIComponent(symbol.toUpperCase())}`;
}

/** Mã đang xem, đọc từ đường dẫn `/symbol/[symbol]`; `null` nếu không phải màn đó. */
export function symbolFromPath(pathname: string): string | null {
  const match = /^\/symbol\/([^/?#]+)/.exec(pathname);
  if (!match) return null;
  return decodeURIComponent(match[1]).toUpperCase();
}

/** Kết quả phân giải một dòng lệnh. Thuần, không đụng router — để test được. */
export type CommandResult =
  | { kind: "screen"; screen: TerminalScreen }
  | { kind: "symbol"; symbol: string; href: string }
  | { kind: "help" }
  | { kind: "empty" }
  | { kind: "unknown"; input: string };

/**
 * Phân giải dòng lệnh: từ khoá màn, HELP/?, hoặc mã cổ phiếu 3–4 ký tự.
 * Từ khoá màn được xét trước mã để lệnh như `SET` không bị hiểu thành mã.
 */
export function resolveCommand(raw: string): CommandResult {
  const command = raw.trim().toUpperCase();
  if (!command) return { kind: "empty" };
  if (command === "HELP" || command === "?") return { kind: "help" };

  const screen = findScreenByCommand(command);
  if (screen) return { kind: "screen", screen };

  if (SYMBOL_COMMAND_PATTERN.test(command)) {
    return { kind: "symbol", symbol: command, href: symbolHref(command) };
  }

  return { kind: "unknown", input: command };
}
