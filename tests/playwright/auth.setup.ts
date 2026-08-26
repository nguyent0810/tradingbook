import fs from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";

const authDir = path.join(process.cwd(), "playwright", ".auth");
const authFile = path.join(authDir, "user.json");

const email =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_EMAIL ?? "e2e-trades-layout@example.test";
const password =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_PASSWORD ??
  "PlaywrightTradesLayout!99";

setup("authenticate layout user", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await page.goto("/login");
  // Nhãn của màn F6 là tiếng Việt; nút gửi mang `data-testid` ổn định nên bám vào
  // testid thay vì chữ trên nút (chữ đổi theo trạng thái: "ĐANG ĐĂNG NHẬP…").
  await page.getByLabel("TÀI KHOẢN").fill(email);
  await page.getByLabel("MẬT KHẨU").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard");
  await page.context().storageState({ path: authFile });
});
