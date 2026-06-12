import { expect, test } from "@playwright/test";

test.describe("Cyber Command Deck — NO TRADE preview smoke", () => {
  test("shows stance, RS banner, and no trade CTAs", async ({ page }) => {
    await page.goto("/design-preview/cyber-cockpit");
    await page.waitForSelector('[data-testid="dashboard-cyber"]');
    await page.waitForSelector('[data-testid="dashboard-cyber-decision-core"]', {
      state: "visible",
    });

    await expect(page.getByRole("heading", { name: "NO TRADE", level: 2 })).toBeVisible();
    await expect(
      page.getByText(/Context only — relative strength does not qualify a setup/)
    ).toBeVisible();

    const tradeGate = page.getByRole("region", { name: "Trade Gate" });
    await expect(tradeGate).toBeVisible();
    await expect(tradeGate.getByText("Go")).toHaveCount(0);

    await expect(page.getByRole("link", { name: "Open pipeline" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log trade" })).toHaveCount(0);
  });
});
