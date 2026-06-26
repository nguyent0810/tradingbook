import { test, expect } from "@playwright/test";

test.describe("/paper-lab arena", () => {
  test("shows disclaimer and mock agents", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-disclaimer")).toBeVisible();
    await expect(page.getByTestId("paper-lab-leaderboard")).toBeVisible();
    await expect(page.getByTestId("leaderboard-row-swing_trader")).toBeVisible();
    await expect(page.getByText("Paper only")).toBeVisible();
  });

  test("compact portfolio rail and workspace sections", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-portfolios")).toBeVisible();
    await expect(page.getByTestId("paper-lab-cio")).toBeVisible();
    await expect(page.getByTestId("paper-lab-positions")).toBeVisible();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeVisible();
    await expect(page.getByText("View JSON").first()).toBeVisible();
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
