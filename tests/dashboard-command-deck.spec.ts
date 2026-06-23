import { expect, test } from "@playwright/test";

test.describe("Dashboard Command Deck — production route smoke", () => {
  test("loads approved Command Deck on /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard");
    await page.waitForSelector('[data-testid="dashboard-cyber"]', { state: "visible" });
    await page.waitForSelector('[data-testid="dashboard-cyber-decision-core"]', {
      state: "visible",
    });

    await expect(page.getByTestId("dashboard-page-header")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's decision", level: 1 })).toBeVisible();
    await expect(page.getByTestId("command-deck-bar")).toBeVisible();
    await expect(page.getByTestId("dashboard-cyber-trade-gate")).toBeVisible();
    await expect(page.getByTestId("command-deck-opportunity-radar")).toBeVisible();

    const rsTable = page.getByTestId("command-deck-rs-table");
    await expect(rsTable.getByRole("columnheader", { name: "Trace" })).toHaveCount(0);
    await expect(rsTable.locator(".cd-sparkline")).toHaveCount(0);
    await expect(rsTable.getByRole("columnheader", { name: "RS20" })).toHaveClass(/text-right/);

    const tradeGate = page.getByTestId("dashboard-cyber-trade-gate");
    const stanceHeading = page.locator('[data-testid="dashboard-cyber-decision-core"] h2').first();
    await expect(stanceHeading).toBeVisible();
    const stance = (await stanceHeading.textContent())?.trim() ?? "";

    if (stance === "NO TRADE") {
      await expect(tradeGate.getByText("Go", { exact: true })).toHaveCount(0);
      const summary = page.getByTestId("dashboard-evidence-summary");
      if ((await summary.count()) > 0) {
        await expect(summary).toContainText(/Why no trade today:/i);
      }
    }

    const primary = page.getByTestId("dashboard-header-primary-cta");
    const secondary = page.getByTestId("dashboard-header-secondary-cta");
    if ((await secondary.count()) > 0) {
      const primaryBox = await primary.boundingBox();
      const secondaryBox = await secondary.boundingBox();
      expect(primaryBox).not.toBeNull();
      expect(secondaryBox).not.toBeNull();
      if (primaryBox && secondaryBox) {
        expect(primaryBox.x).toBeLessThan(secondaryBox.x);
      }
    }

    await expect(page.getByTestId("dashboard-v3-evidence-layer")).toHaveCount(0);

    const sessionEvidence = page.getByTestId("command-deck-evidence");
    await expect(sessionEvidence).toBeVisible();
    await expect(sessionEvidence.getByRole("heading", { name: "Session Evidence" })).toBeVisible();

    const foreign1dRow = sessionEvidence.locator(".cd-evidence-row").filter({ hasText: "Foreign 1D" });
    const foreignCovRow = sessionEvidence.locator(".cd-evidence-row").filter({ hasText: "Foreign cov." });
    await expect(foreign1dRow).toHaveCount(1);
    await expect(foreignCovRow).toHaveCount(1);
    await expect(foreign1dRow).toContainText(/₫ net/);
    await expect(foreignCovRow).toContainText(/OK \(\d+%\)/);

    const foreign5dRow = sessionEvidence.locator(".cd-evidence-row").filter({ hasText: "Foreign 5D" });
    const foreign10dRow = sessionEvidence.locator(".cd-evidence-row").filter({ hasText: "Foreign 10D" });
    if ((await foreign5dRow.count()) > 0) {
      await expect(foreign5dRow).toContainText(/₫ net/);
    }
    if ((await foreign10dRow.count()) > 0) {
      await expect(foreign10dRow).toContainText(/₫ net/);
    }

    await expect(sessionEvidence.getByText("Scanner diagnostics", { exact: true })).toBeVisible();
    await expect(sessionEvidence.getByText("Data freshness", { exact: true })).toBeVisible();
    await expect(sessionEvidence.getByText("Market blockers", { exact: true })).toBeVisible();
    await expect(sessionEvidence.getByText("Technical evidence", { exact: true })).toBeVisible();

    const evidenceBox = await sessionEvidence.boundingBox();
    expect(evidenceBox).not.toBeNull();
    if (evidenceBox) {
      expect(evidenceBox.width).toBeGreaterThan(200);
      expect(evidenceBox.height).toBeGreaterThan(80);
    }
  });
});
