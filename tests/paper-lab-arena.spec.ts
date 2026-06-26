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

  test("command center panels visible without tabs", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-header-grid")).toBeVisible();
    await expect(page.getByTestId("paper-lab-portfolios")).toBeVisible();
    await expect(page.getByTestId("paper-lab-cio")).toBeVisible();
    await expect(page.getByTestId("paper-lab-recent-battles")).toBeVisible();
    await expect(page.getByTestId("paper-lab-positions")).toBeVisible();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeVisible();
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

  test("battle replay uses cards at 1280px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-battle-cards")).toBeVisible();
    await expect(page.locator(".paper-lab-battle-table-wrap")).toBeHidden();
  });

  test("battle replay uses cards at 1920px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-battle-cards")).toBeVisible();
    await expect(page.locator(".paper-lab-battle-table-wrap")).toBeHidden();
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
    await page.screenshot({ path: "test-results/paper-lab-arena-1280.png", fullPage: true });
  });

  test("arena layout screenshot at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-arena")).toBeVisible();
    await page.screenshot({ path: "test-results/paper-lab-arena-1440.png", fullPage: true });
  });
});
