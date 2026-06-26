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
});
