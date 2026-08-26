import { expect, test } from "@playwright/test";
import path from "node:path";

/**
 * Ma trận bề rộng cho TradeLog VN Terminal v4.
 *
 * Bàn giao §6 chốt **bề rộng tối thiểu**: 1160px (bảng điều khiển) và 1020px
 * (chi tiết mã); §8 ghi breakpoint tablet/mobile là NGOÀI phạm vi bản này. Nên
 * ma trận chạy từ đúng ngưỡng tối thiểu của TỪNG màn trở lên: dưới ngưỡng đó
 * thanh cuộn ngang là hành vi có chủ đích (`min-width` trong CSS), đo ở 390px
 * chỉ báo lỗi cho một quyết định thiết kế chứ không bắt được khuyết tật nào.
 *
 * Ngược lại, đo ĐÚNG TẠI ngưỡng tối thiểu mới là phép thử có giá trị: đó là
 * điểm hẹp nhất mà bản thiết kế cam kết vẫn vừa.
 */
const COMMON_VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
];

type Route = {
  slug: string;
  path: string;
  readySelector: string;
  /** Bề rộng tối thiểu bản thiết kế cam kết (bàn giao §6). */
  minWidth: number;
};

const ROUTES: Route[] = [
  {
    slug: "dashboard",
    path: "/dashboard",
    readySelector: '[data-testid="f1-dashboard"]',
    minWidth: 1160,
  },
  { slug: "setups", path: "/setups", readySelector: '[data-testid="f2-setups"]', minWidth: 1160 },
  {
    slug: "paper-lab",
    path: "/paper-lab",
    readySelector: '[data-testid="f3-arena"]',
    minWidth: 1160,
  },
  { slug: "book", path: "/book", readySelector: '[data-testid="f4-book"]', minWidth: 1160 },
  {
    slug: "settings",
    path: "/settings",
    readySelector: '[data-testid="f5-settings"]',
    minWidth: 1160,
  },
  { slug: "states", path: "/states", readySelector: '[data-testid="f8-states"]', minWidth: 1160 },
];

function viewportsFor(route: Route) {
  return [
    ...COMMON_VIEWPORTS,
    { name: `${route.minWidth}x800 (tối thiểu)`, width: route.minWidth, height: 800 },
  ];
}

test.describe("Ma trận bề rộng — các màn cần đăng nhập", () => {
  for (const route of ROUTES) {
    for (const vp of viewportsFor(route)) {
      test(`${route.slug} @ ${vp.name} — không tràn ngang`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path);

        // KHÔNG nuốt lỗi chờ selector. Sáu màn này luôn dựng phần tử gốc kể cả
        // khi dữ liệu rỗng hoặc có lỗi nạp — trạng thái rỗng/lỗi nằm BÊN TRONG
        // màn, không thay thế màn. Nuốt lỗi ở đây sẽ cho pass giả: chuyển hướng
        // về đăng nhập hay một trang lỗi cũng "không tràn ngang".
        await expect(page.locator(route.readySelector)).toBeVisible({ timeout: 30_000 });

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
        });

        await page.screenshot({
          path: path.join(
            "screenshots",
            "responsive-matrix",
            `${route.slug}-${vp.width}x${vp.height}.png`
          ),
          fullPage: true,
        });

        // Dung sai nhỏ cho thanh cuộn và làm tròn dưới pixel.
        expect(
          overflow.scrollWidth,
          `tràn ngang ở ${route.slug} @ ${vp.name}: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`
        ).toBeLessThanOrEqual(overflow.clientWidth + 16);
      });
    }
  }
});
