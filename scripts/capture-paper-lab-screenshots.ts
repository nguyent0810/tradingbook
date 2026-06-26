/**
 * Capture Paper Lab layout refinement screenshots.
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

async function gotoArena(page: import("playwright").Page) {
  await page.goto(`${baseURL}/paper-lab`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="paper-lab-command-shell"]');
  await page.waitForSelector('[data-testid="paper-lab-arena"]');
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext(
    fs.existsSync(authFile) ? { storageState: authFile } : {}
  );
  await ensureAuth(context);

  const shots: Array<{
    name: string;
    width: number;
    height: number;
    run: (page: import("playwright").Page) => Promise<void>;
  }> = [
    {
      name: "layout-1280-positions",
      width: 1280,
      height: 720,
      run: async (page) => {
        await page.evaluate(() => window.scrollTo(0, 0));
        const positions = page.getByTestId("paper-lab-positions");
        if ((await positions.count()) > 0) {
          const rHelp = positions
            .locator("thead th")
            .filter({ hasText: /^R$/ })
            .locator(".paper-lab-help-icon");
          if ((await rHelp.count()) > 0) {
            await rHelp.first().hover();
          }
        }
      },
    },
    {
      name: "layout-1280-battle",
      width: 1280,
      height: 720,
      run: async (page) => {
        await page.getByTestId("workspace-tab-battle").click();
        await page.waitForSelector('[data-testid="paper-lab-battle-replay"]');
      },
    },
    {
      name: "layout-1440-positions",
      width: 1440,
      height: 900,
      run: async (page) => {
        await page.getByTestId("workspace-tab-positions").click();
        await page.evaluate(() => window.scrollTo(0, 0));
      },
    },
    {
      name: "layout-1440-workspace",
      width: 1440,
      height: 900,
      run: async (page) => {
        await page.getByTestId("paper-lab-workspace").scrollIntoViewIfNeeded();
      },
    },
  ];

  for (const shot of shots) {
    const page = await context.newPage();
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await gotoArena(page);
    await shot.run(page);
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(outDir, `${shot.name}.png`),
      fullPage: shot.name.includes("1440-workspace") ? false : true,
    });
    await page.close();
    console.log(`Captured ${shot.name}`);
  }

  await browser.close();
  console.log(`Screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
