import { expect, test } from "@playwright/test";
import { formatViolations, runAxe, seriousViolations } from "./axe-helpers";

test.describe("Accessibility audit (axe-core) — authenticated routes", () => {
  test("dashboard has no serious/critical violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="dashboard-v2-hero-band"]', { timeout: 30_000 });
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });

  test("setups has no serious/critical violations", async ({ page }) => {
    await page.goto("/setups");
    await page.waitForLoadState("networkidle");
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });

  test("paper-lab has no serious/critical violations", async ({ page }) => {
    await page.goto("/paper-lab");
    await page.waitForLoadState("networkidle");
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });
});
