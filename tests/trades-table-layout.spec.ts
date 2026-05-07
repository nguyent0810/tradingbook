import { test, expect } from "@playwright/test";

/**
 * Ledger column order (must match `src/app/(dashboard)/trades/page.tsx`).
 * Symbol … Status … EOD … Hold … Entry Price …
 */
const COL = {
  symbol: 0,
  setup: 1,
  direction: 2,
  playbook: 3,
  status: 4,
  freshness: 5,
  hold: 6,
  entryDate: 7,
  entryPrice: 8,
} as const;

test.describe("/trades table layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/trades");
    await expect(page.getByTestId("trades-table")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("counts, row geometry, horizontal scroll, sticky clearance, cells", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Trades" })
    ).toBeVisible();

    await expect(page.getByTestId("trades-header-count")).toHaveText(/2 trades/);

    const scroll = page.getByTestId("trades-scroll-container");
    const header = page.getByTestId("trades-table-header");
    const rows = page.getByTestId("trades-table-row");

    await expect(rows).toHaveCount(2);

    const needsHorizontalScroll = await scroll.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1
    );
    expect(
      needsHorizontalScroll,
      "Ledger should scroll horizontally when wider than viewport"
    ).toBe(true);

    const hb = await header.boundingBox();
    const rb = await rows.first().boundingBox();
    expect(hb).toBeTruthy();
    expect(rb).toBeTruthy();
    expect(
      rb!.y,
      "First body row must sit below thead bottom (no sticky overlap)"
    ).toBeGreaterThanOrEqual(hb!.y + hb!.height - 1);

    for (let i = 0; i < 2; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(
        box!.height,
        `Row ${i} should have normal row height`
      ).toBeGreaterThan(28);
    }

    const rowOpen = rows.filter({ hasText: "E2EOPEN" }).first();
    await expect(rowOpen.locator("td").nth(COL.symbol)).toBeVisible();
    await expect(rowOpen.locator("td").nth(COL.symbol)).toContainText("E2EOPEN");
    await expect(rowOpen.locator("td").nth(COL.status)).toContainText("OPEN");
    await expect(rowOpen.locator("td").nth(COL.freshness)).toBeVisible();
    await expect(rowOpen.locator("td").nth(COL.hold)).toBeVisible();
    await expect(rowOpen.locator("td").nth(COL.entryPrice)).toBeVisible();

    const rowClosed = rows.filter({ hasText: "E2ECLS" }).first();
    await expect(rowClosed.locator("td").nth(COL.symbol)).toContainText(
      "E2ECLS"
    );
    await expect(rowClosed.locator("td").nth(COL.status)).toContainText(
      "CLOSED"
    );
    await expect(rowClosed.locator("td").nth(COL.freshness)).toBeVisible();
    await expect(rowClosed.locator("td").nth(COL.entryPrice)).toBeVisible();
  });
});
