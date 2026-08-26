import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

/**
 * Hai họ chữ của TradeLog VN Terminal (bàn giao §3):
 * - IBM Plex Sans cho nhãn và diễn giải
 * - IBM Plex Mono cho mọi con số, mã cổ phiếu, log và nhãn kỹ thuật
 *
 * Cả hai có bộ Vietnamese — bắt buộc, giao diện toàn tiếng Việt có dấu.
 */
export const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

/**
 * Class gộp để gắn lên phần tử gốc của mỗi màn.
 *
 * `tm-fonts` phải đi **cùng** hai class biến của next/font: nó khai
 * `--tm-font-sans/mono` tham chiếu `--font-plex-*`, mà hai biến đó chỉ tồn tại
 * trên chính phần tử mang class của next/font. Tách rời hai thứ này ra là biến
 * font terminal rỗng và cả app rơi về font hệ thống.
 */
export const terminalFontClass = `tm-fonts ${plexSans.variable} ${plexMono.variable}`;
