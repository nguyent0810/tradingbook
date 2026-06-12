import { chromium, devices } from "playwright";
import path from "node:path";

const url = "http://127.0.0.1:3000/design-preview/cyber-cockpit";
const outDir = path.join(process.cwd(), "screenshots");

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
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForDeckVisible(page);
  await page.waitForTimeout(300);
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
