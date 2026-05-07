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
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard");
  await page.context().storageState({ path: authFile });
});
