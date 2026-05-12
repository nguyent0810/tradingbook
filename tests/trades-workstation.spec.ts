import { test, expect } from "@playwright/test";

test.describe("/trades workstation (review session & compact)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trades");
    await expect(page.getByTestId("trades-table")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("invalid reviewFocus is replaced with canonical queue head", async ({
    page,
  }) => {
    const bad =
      "00000000-0000-0000-0000-000000000001";
    await page.goto(`/trades?reviewSession=1&reviewFocus=${bad}`);
    await expect(page.getByTestId("trades-review-session-bar")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).not.toHaveURL(new RegExp(`reviewFocus=${bad}`));
    await expect(page.url()).toMatch(/reviewFocus=[^&]+/);
  });

  test("review session shows bar, focus workspace, cluster divider, next navigation", async ({
    page,
  }) => {
    await page.goto("/trades?reviewSession=1");
    const bar = page.getByTestId("trades-review-session-bar");
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("focus-review-workspace")).toBeVisible();
    await expect(page.getByTestId("trades-cluster-divider").first()).toBeVisible();

    const next = bar.getByRole("button", { name: /next trade/i });
    await expect(next).toBeEnabled();
    const before = page.url();
    await next.click();
    await expect(page).not.toHaveURL(before);
    await expect(page.url()).toMatch(/reviewFocus=/);
  });

  test("compactReview hides session briefing card", async ({ page }) => {
    await page.goto("/trades?compactReview=1");
    await expect(page.getByTestId("trades-table")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("trades-session-briefing")).toHaveCount(0);
  });

  test("ledger shows horizontal scroll hint for wide table", async ({ page }) => {
    await expect(page.getByTestId("trades-ledger-scroll-hint")).toBeVisible({
      timeout: 30_000,
    });
  });
});
