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

const ROUTES = [
  { slug: "landing", path: "/" },
  { slug: "login", path: "/login" },
];

test.describe("Responsive matrix — public routes", () => {
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route.slug} @ ${vp.name} — no horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
        });

        await page.screenshot({
          path: path.join("screenshots", "responsive-matrix", `${route.slug}-${vp.name}.png`),
          fullPage: true,
        });

        expect(
          overflow.scrollWidth,
          `horizontal overflow on ${route.slug} @ ${vp.name}: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`
        ).toBeLessThanOrEqual(overflow.clientWidth + 16);
      });
    }
  }
});
