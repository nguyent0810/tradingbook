import { expect, test } from "@playwright/test";
import { formatViolations, runAxe, seriousViolations } from "./axe-helpers";

test.describe("Accessibility audit (axe-core) — authenticated routes", () => {
  test("dashboard has no serious/critical violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="f1-dashboard"]', { timeout: 30_000 });
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });

  test("setups has no serious/critical violations", async ({ page }) => {
    await page.goto("/setups");
    await page.waitForSelector('[data-testid="f2-setups"]', { timeout: 30_000 });
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });

  test("paper-lab has no serious/critical violations", async ({ page }) => {
    await page.goto("/paper-lab");
    await page.waitForSelector('[data-testid="f3-arena"]', { timeout: 30_000 });
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });

  test("book has no serious/critical violations", async ({ page }) => {
    await page.goto("/book");
    await page.waitForSelector('[data-testid="f4-book"]', { timeout: 30_000 });
    const result = await runAxe(page);
    expect(seriousViolations(result), formatViolations(result)).toEqual([]);
  });
});
