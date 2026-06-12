import { chromium, devices } from "playwright";
import path from "node:path";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const email =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_EMAIL ?? "e2e-trades-layout@example.test";
const password =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_PASSWORD ?? "PlaywrightTradesLayout!99";
const outDir = path.join(process.cwd(), "screenshots");

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard");
}

async function waitForDeckVisible(page) {
  await page.waitForSelector('[data-testid="dashboard-cyber"]', { timeout: 30_000 });
  await page.waitForSelector('[data-testid="command-deck-opportunity-radar"]', {
    timeout: 30_000,
  });
  await page.waitForSelector('[data-testid="command-deck-rs-table"]', { timeout: 30_000 });
  await page.waitForTimeout(800);
}

async function capture(name, contextOptions) {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await login(page);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await waitForDeckVisible(page);
  await page.locator('[data-testid="dashboard-cyber"]').screenshot({
    path: path.join(outDir, name),
    animations: "disabled",
  });
  await browser.close();
}

await capture("cyber-cockpit-desktop.png", {
  ...devices["Desktop Chrome"],
  viewport: { width: 1440, height: 900 },
});
await capture("cyber-cockpit-mobile.png", {
  ...devices["iPhone 13"],
});
console.log("Saved screenshots/cyber-cockpit-desktop.png and cyber-cockpit-mobile.png");
