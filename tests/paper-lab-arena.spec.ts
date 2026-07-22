import { test, expect } from "@playwright/test";

test.describe("/paper-lab arena", () => {
  test("shows arena page shell, section index and simulation badge", async ({ page }) => {
    await page.goto("/paper-lab");
    // Arena is a first-class page inside the global shell (no app sidebar / utility bar).
    await expect(page.getByTestId("paper-lab-command-shell")).toBeVisible();
    await expect(page.getByTestId("paper-lab-sidebar")).toBeVisible();
    await expect(page.getByTestId("paper-lab-disclaimer")).toBeVisible();
    await expect(page.getByTestId("paper-lab-disclaimer")).toContainText("Chỉ mô phỏng");
  });

  test("section index navigates the on-page zones (not a route sidebar)", async ({ page }) => {
    await page.goto("/paper-lab");
    const index = page.getByTestId("paper-lab-sidebar");
    // The former app sidebar is now a light section index of the 5 narrative zones.
    for (const label of ["Bây giờ", "Đồng thuận", "Tranh luận", "Quyết định", "Bài học"]) {
      await expect(index.getByRole("link", { name: label })).toBeVisible();
    }
    // No standalone utility bar / route menu inside the page.
    await expect(page.getByTestId("paper-lab-top-nav")).toHaveCount(0);
  });

  test("workspace defaults to open positions tab", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-workspace")).toBeVisible();
    await expect(page.getByTestId("workspace-tab-positions")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("paper-lab-positions")).toBeVisible();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeHidden();
    await expect(page.getByTestId("paper-lab-recent-battles")).toBeHidden();
  });

  test("battle replay tab includes recent battles summary", async ({ page }) => {
    await page.goto("/paper-lab");
    await page.getByTestId("workspace-tab-battle").click();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeVisible();
    await expect(page.getByTestId("paper-lab-recent-battles")).toBeVisible();
    await expect(page.getByTestId("paper-lab-battle-cards")).toBeVisible();
    await expect(page.locator(".paper-lab-battle-table-wrap")).toBeHidden();
  });

  test("agent league strip sits below header cards", async ({ page }) => {
    await page.goto("/paper-lab");
    // Workspace re-architecture: the header grid lives in the NOW zone and the
    // agent league in the CONSENSUS zone (both on the one Arena workspace).
    await expect(page.getByTestId("paper-lab-arena-hero")).toBeVisible();
    await expect(page.getByTestId("paper-lab-header-grid")).toBeVisible();
    await expect(page.getByTestId("paper-lab-portfolios")).toBeVisible();
    await expect(page.getByText("Đội hình Agent")).toBeVisible();
  });

  test("agent portfolio cards show full names", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-portfolios").getByText("Swing Trader")).toBeVisible();
  });

  test("open positions R column has help tooltip", async ({ page }) => {
    await page.goto("/paper-lab");
    const rHeader = page.getByTestId("paper-lab-positions").locator("thead th").filter({ hasText: /^R$/ });
    await expect(rHeader.locator(".paper-lab-help-icon")).toBeVisible();
    await expect(rHeader.locator(".paper-lab-help-icon")).toHaveAttribute(
      "title",
      "R = current profit or loss divided by the initial risk from entry to stop loss."
    );
  });

  test("command center bottom panels visible", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-header-grid")).toBeVisible();
    await expect(page.getByTestId("paper-lab-portfolios")).toBeVisible();
    await expect(page.getByTestId("paper-lab-cio")).toBeVisible();
    await expect(page.getByTestId("paper-lab-decisions")).toBeVisible();
    await expect(page.getByTestId("paper-lab-regime-explanation")).toBeVisible();
    await expect(page.getByText("Xem JSON").first()).toBeVisible();
  });

  test("hall of fame route accessible for leaderboard data", async ({ page }) => {
    await page.goto("/paper-lab/hof");
    await expect(page.getByTestId("paper-lab-leaderboard")).toBeVisible();
  });

  test("agent details drawer opens and is not clipped", async ({ page }) => {
    await page.goto("/paper-lab");
    await expect(page.locator(".paper-lab-agent-popover")).toHaveCount(0);
    await page.getByTestId("agent-details-btn-swing_trader").click();
    const drawer = page.getByTestId("paper-lab-agent-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Swing Trader")).toBeVisible();
    await expect(drawer.getByText("Tiền mặt")).toBeVisible();
    await drawer.getByRole("button", { name: "Đóng" }).click();
    await expect(drawer).not.toBeVisible();
  });

  test("CIO panel shows human consensus label not raw weighted text", async ({ page }) => {
    await page.goto("/paper-lab");
    const cio = page.getByTestId("paper-lab-cio");
    await expect(cio).toBeVisible();
    const text = await cio.textContent();
    expect(text ?? "").not.toMatch(/weighted consensus/i);
  });

  test("arena layout screenshot at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-arena")).toBeVisible();
    await page.screenshot({ path: "screenshots/paper-lab-arena/layout-1280-positions.png", fullPage: true });
  });

  test("arena layout screenshot at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/paper-lab");
    await expect(page.getByTestId("paper-lab-arena")).toBeVisible();
    await page.screenshot({ path: "screenshots/paper-lab-arena/layout-1440-positions.png", fullPage: true });
  });

  test("battle tab screenshot at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/paper-lab");
    await page.getByTestId("workspace-tab-battle").click();
    await expect(page.getByTestId("paper-lab-battle-replay")).toBeVisible();
    await page.screenshot({ path: "screenshots/paper-lab-arena/layout-1280-battle.png", fullPage: true });
  });
});
