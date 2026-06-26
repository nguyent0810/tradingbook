/**
 * Capture Paper Lab Arena smoke screenshots at required viewports.
 * Usage: npx tsx scripts/capture-paper-lab-screenshots.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = path.join(process.cwd(), "screenshots", "paper-lab-arena");
const authFile = path.join(process.cwd(), "playwright", ".auth", "user.json");

const email =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_EMAIL ?? "e2e-trades-layout@example.test";
const password =
  process.env.PLAYWRIGHT_TRADES_LAYOUT_PASSWORD ?? "PlaywrightTradesLayout!99";

const viewports = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
] as const;

async function ensureAuth(context: import("playwright").BrowserContext) {
  if (fs.existsSync(authFile)) return;
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 120_000 });
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
  await page.close();
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext(
    fs.existsSync(authFile) ? { storageState: authFile } : {}
  );
  await ensureAuth(context);

  for (const vp of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(`${baseURL}/paper-lab`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="paper-lab-command-shell"]');
    await page.waitForSelector('[data-testid="paper-lab-arena"]');

    await page.screenshot({
      path: path.join(outDir, `${vp.name}-top.png`),
      fullPage: false,
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(outDir, `${vp.name}-workspace.png`),
      fullPage: false,
    });

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByTestId("agent-details-btn-swing_trader").click();
    await page.waitForSelector('[data-testid="paper-lab-agent-drawer"]', {
      state: "visible",
    });
    await page.screenshot({
      path: path.join(outDir, `${vp.name}-drawer.png`),
      fullPage: false,
    });
    await page.getByTestId("paper-lab-agent-drawer").getByRole("button", { name: "Close" }).click();

    await page.getByTestId("paper-lab-decisions").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(outDir, `${vp.name}-decisions.png`),
      fullPage: false,
    });

    await page.close();
    console.log(`Captured ${vp.name}`);
  }

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
