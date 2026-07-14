import { expect, test } from "@playwright/test";

test.describe("Dashboard Decision Cockpit — production route smoke", () => {
  test("loads the Decision Cockpit on /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");
    await page.waitForSelector('[data-testid="dashboard-v2-hero-band"]', { state: "visible" });

    await expect(page.getByTestId("dashboard-page-header")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's decision", level: 1 })).toBeVisible();
    await expect(page.getByTestId("dashboard-decision-hero")).toBeVisible();
    await expect(page.getByTestId("dashboard-cockpit-zone-opportunity")).toBeVisible();

    const verdictHeading = page
      .locator('[data-testid="dashboard-decision-hero"] h2')
      .first();
    await expect(verdictHeading).toBeVisible();
    const verdict = (await verdictHeading.textContent())?.trim() ?? "";

    if (verdict === "NO TRADE") {
      await expect(page.getByTestId("dashboard-verdict-preservation")).toBeVisible();
    }

    // Opportunity board: either surfaced candidates or the near-miss/rejection panel — never both absent.
    const opportunityZone = page.getByTestId("dashboard-cockpit-zone-opportunity");
    const hasCandidatesPanel =
      (await opportunityZone.getByTestId("dashboard-opportunity-candidates-panel").count()) > 0;
    const hasNearMissPanel =
      (await opportunityZone.getByTestId("dashboard-near-miss-panel").count()) > 0;
    expect(hasCandidatesPanel || hasNearMissPanel).toBe(true);

    await expect(page.getByTestId("dashboard-setup-quality-ladder")).toBeVisible();

    // Tomorrow's plan and the two collapsed secondary sections are always present.
    await expect(page.getByRole("heading", { name: "Tomorrow's plan" })).toBeVisible();
    await expect(page.getByTestId("dashboard-secondary-collapsible")).toBeVisible();

    // Guard against the retired cyber dashboard ever reappearing.
    await expect(page.getByTestId("dashboard-cyber")).toHaveCount(0);
  });

  test("Book snapshot performance panel loads after expanding (regression: previously stuck on loading skeleton in dev)", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");

    const bookSnapshot = page.getByTestId("dashboard-book-snapshot");
    await expect(bookSnapshot).toBeVisible();

    // Native <details> starts collapsed — expand it to mount the lazy performance panel.
    await bookSnapshot.locator("summary").click();

    const panel = page.getByTestId("dashboard-performance-panel");
    const empty = page.getByTestId("dashboard-performance-empty");

    // Success or empty state must resolve — the panel must not remain frozen
    // on its loading skeleton. Root cause: `next dev`'s HMR websocket was
    // blocked by Next 16's allowedDevOrigins default, which silently broke
    // client-side effect scheduling app-wide (see next.config.ts).
    await expect(panel.or(empty)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Loading performance panel")).toHaveCount(0);
  });
});
