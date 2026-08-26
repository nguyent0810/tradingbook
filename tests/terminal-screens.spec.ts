import { expect, test } from "@playwright/test";

/**
 * Smoke cho các màn của TradeLog VN Terminal v4 cần đăng nhập.
 *
 * Thay cho ba spec cũ (`dashboard-command-deck`, `paper-lab-arena`,
 * `setups-workstation`) vốn bám vào `data-testid` và tiêu đề tiếng Anh của bản
 * giao diện trước — những phần tử đó không còn tồn tại sau bản redesign.
 *
 * Phạm vi CHÍNH XÁC là sáu màn dưới đây. Hai màn còn lại cố ý nằm ngoài:
 *   • F6 Phiên (`/login`, `/register`) là route công khai — đã có
 *     `landing-auth.spec.ts` và `accessibility-public.spec.ts` phủ.
 *   • F7 Chi tiết mã (`/symbol/[symbol]`) cần một mã có thật trong DB; ở đây sẽ
 *     thành một test rỗng nghĩa (404 cũng "không tràn ngang"). Bề rộng tối thiểu
 *     1020px của F7 được đo bằng bản dựng tĩnh, ghi trong
 *     `docs/redesign/terminal-v4/G8-QA.md` §7.4.
 *
 * Chỉ khẳng định điều luôn đúng bất kể dữ liệu: màn dựng được, và shell có mặt.
 * Không khẳng định số liệu, vì mọi panel đều có thể ở trạng thái rỗng hoặc lỗi
 * hợp lệ tuỳ dữ liệu trong DB.
 */
const SCREENS: { slug: string; path: string; testId: string }[] = [
  { slug: "F1 điều khiển", path: "/dashboard", testId: "f1-dashboard" },
  { slug: "F2 thiết lập", path: "/setups", testId: "f2-setups" },
  { slug: "F3 đấu trường", path: "/paper-lab", testId: "f3-arena" },
  { slug: "F4 sổ lệnh", path: "/book", testId: "f4-book" },
  { slug: "F5 cài đặt", path: "/settings", testId: "f5-settings" },
  { slug: "F8 trạng thái", path: "/states", testId: "f8-states" },
];

test.describe("Terminal v4 — smoke các màn", () => {
  for (const screen of SCREENS) {
    test(`${screen.slug} dựng được`, async ({ page }) => {
      await page.goto(screen.path);
      await expect(page.getByTestId(screen.testId)).toBeVisible({ timeout: 30_000 });
      // Shell dùng chung: nav phím F và dòng lệnh phải có ở mọi màn.
      await expect(page.locator(".tm-fnav")).toBeVisible();
      await expect(page.locator(".tm-cmdline")).toBeVisible();
    });
  }

  test("F9 mở bảng trợ giúp, ESC đóng", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("f1-dashboard")).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("F9");
    const help = page.getByRole("dialog");
    await expect(help).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });
});
