import { test, expect } from "@playwright/test";

test.describe("/paper-lab arena", () => {
  test("shows command shell and paper-only badge", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-command-shell")).toBeVisible();
    await expect(page.getByTestId("paper-lab-sidebar")).toBeVisible();
    await expect(page.getByTestId("paper-lab-top-nav")).toBeVisible();
    await expect(page.getByTestId("paper-lab-disclaimer")).toBeVisible();
    await expect(page.getByText("Paper Only")).toBeVisible();
  });

  test("utility bar has compact back to dashboard control", async ({ page }) => {
    await page.goto("/paper-lab");
    const utilityBar = page.getByTestId("paper-lab-top-nav");
    await expect(utilityBar.getByRole("link", { name: "Arena" })).toHaveCount(0);
    await expect(utilityBar.getByRole("link", { name: "Battles" })).toHaveCount(0);
    await expect(utilityBar.getByRole("link", { name: "Hall of Fame" })).toHaveCount(0);
    await expect(utilityBar.getByText("← Dashboard")).toHaveCount(0);
    const back = page.getByTestId("paper-lab-back-dashboard");
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/dashboard");
    await expect(back).toHaveAttribute("title", "Back to Dashboard");
    await expect(page.getByTestId("paper-lab-sidebar").locator('a[href="/paper-lab"]')).toBeVisible();
  });

  test("workspace defaults to open positions tab", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-workspace")).toBeVisible();
    await expect(page.getByTestId("workspace-tab-positions")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("paper-lab-positions")).toBeVisible();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeHidden();
    await expect(page.getByTestId("paper-lab-recent-battles")).toBeHidden();
  });

  test("battle replay tab includes recent battles summary", async ({ page }) => {
    await page.goto("/paper-lab");
    await page.getByTestId("workspace-tab-battle").click();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeVisible();
    await expect(page.getByTestId("paper-lab-recent-battles")).toBeVisible();
    await expect(page.getByTestId("paper-lab-battle-cards")).toBeVisible();
    await expect(page.locator(".paper-lab-battle-table-wrap")).toBeHidden();
  });

  test("agent league strip sits below header cards", async ({ page }) => {
    await page.goto("/paper-lab");
    const hero = page.getByTestId("paper-lab-arena-hero");
    await expect(hero).toBeVisible();
    await expect(hero.getByTestId("paper-lab-header-grid")).toBeVisible();
    await expect(hero.getByTestId("paper-lab-portfolios")).toBeVisible();
    await expect(hero.getByText("Agent League")).toBeVisible();
  });

  test("agent portfolio cards show full names", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-portfolios").getByText("Swing Trader")).toBeVisible();
  });

  test("open positions R column has help tooltip", async ({ page }) => {
    await page.goto("/paper-lab");
    const rHeader = page.getByTestId("paper-lab-positions").locator("thead th").filter({ hasText: /^R$/ });
    await expect(rHeader.locator(".paper-lab-help-icon")).toBeVisible();
    await expect(rHeader.locator(".paper-lab-help-icon")).toHaveAttribute(
      "title",
      "R = current profit or loss divided by the initial risk from entry to stop loss."
    );
  });

  test("command center bottom panels visible", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-header-grid")).toBeVisible();
    await expect(page.getByTestId("paper-lab-portfolios")).toBeVisible();
    await expect(page.getByTestId("paper-lab-cio")).toBeVisible();
    await expect(page.getByTestId("paper-lab-decisions")).toBeVisible();
    await expect(page.getByTestId("paper-lab-regime-explanation")).toBeVisible();
    await expect(page.getByText("View JSON").first()).toBeVisible();
  });

  test("hall of fame route accessible for leaderboard data", async ({ page }) => {
    await page.goto("/paper-lab/hof");
    await expect(page.getByTestId("paper-lab-leaderboard")).toBeVisible();
  });

  test("agent details drawer opens and is not clipped", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.locator(".paper-lab-agent-popover")).toHaveCount(0);
    await page.getByTestId("agent-details-btn-swing_trader").click();
    const drawer = page.getByTestId("paper-lab-agent-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Swing Trader")).toBeVisible();
    await expect(drawer.getByText("Cash")).toBeVisible();
    await drawer.getByRole("button", { name: "Close" }).click();
    await expect(drawer).not.toBeVisible();
  });

  test("CIO panel shows human consensus label not raw weighted text", async ({ page }) => {
    await page.goto("/paper-lab");
    const cio = page.getByTestId("paper-lab-cio");
    await expect(cio).toBeVisible();
    const text = await cio.textContent();
    expect(text ?? "").not.toMatch(/weighted consensus/i);
  });

  test("arena layout screenshot at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-arena")).toBeVisible();
    await page.screenshot({ path: "screenshots/paper-lab-arena/layout-1280-positions.png", fullPage: true });
  });

  test("arena layout screenshot at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-arena")).toBeVisible();
    await page.screenshot({ path: "screenshots/paper-lab-arena/layout-1440-positions.png", fullPage: true });
  });

  test("battle tab screenshot at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/paper-lab");
    await page.getByTestId("workspace-tab-battle").click();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeVisible();
    await page.screenshot({ path: "screenshots/paper-lab-arena/layout-1280-battle.png", fullPage: true });
  });
});
