import { expect, test } from "@playwright/test";

test.describe("Setups workstation — production route smoke", () => {
  test("loads the setups workstation on /setups", async ({ page }) => {
    await page.goto("/setups");
    await page.waitForURL("**/setups");
    await expect(page.getByRole("heading", { name: "Setups workstation" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
