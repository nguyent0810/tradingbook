import { test, expect } from "@playwright/test";

test.describe("/paper-lab arena", () => {
  test("shows disclaimer and mock agents", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-disclaimer")).toBeVisible();
    await expect(page.getByTestId("paper-lab-leaderboard")).toBeVisible();
    await expect(page.getByTestId("leaderboard-row-swing_trader")).toBeVisible();
    await expect(page.getByText("Paper only")).toBeVisible();
  });
});
