import { expect, test } from "@playwright/test";
import { formatViolations, runAxe, seriousViolations } from "./axe-helpers";

test.describe("Accessibility audit (axe-core) — public routes", () => {
  test("landing page has no serious/critical violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });

  test("login page has no serious/critical violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });

  test("keyboard: login form is fully reachable via Tab and submit button receives focus", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("TÀI KHOẢN").focus();
    await expect(page.getByLabel("TÀI KHOẢN")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("MẬT KHẨU")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("login-submit")).toBeFocused();
  });
});
