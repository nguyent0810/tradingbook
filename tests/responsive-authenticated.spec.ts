import { expect, test } from "@playwright/test";
import path from "node:path";

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
];

const ROUTES: Array<{ slug: string; path: string; readySelector: string }> = [
  { slug: "dashboard", path: "/dashboard", readySelector: '[data-testid="dashboard-v2-hero-band"]' },
  { slug: "setups", path: "/setups", readySelector: 'h2:has-text("Setups workstation"), h1:has-text("Setups workstation")' },
  { slug: "paper-lab", path: "/paper-lab", readySelector: '[data-testid="paper-lab-workspace"]' },
];

test.describe("Responsive matrix — authenticated routes", () => {
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route.slug} @ ${vp.name} — no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path);
        await page
          .waitForSelector(route.readySelector, { state: "visible", timeout: 30_000 })
          .catch(() => {
            // Some routes render an empty/degraded state locally (sparse seed data);
            // still check overflow on whatever rendered.
          });

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
          };
        });

        await page.screenshot({
          path: path.join("screenshots", "responsive-matrix", `${route.slug}-${vp.name}.png`),
          fullPage: true,
        });

        // Allow a small tolerance (scrollbars, sub-pixel rounding).
        expect(
          overflow.scrollWidth,
          `horizontal overflow on ${route.slug} @ ${vp.name}: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`
        ).toBeLessThanOrEqual(overflow.clientWidth + 16);
      });
    }
  }
});
