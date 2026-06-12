import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardPageHeader } from "./dashboard-page-header";

describe("DashboardPageHeader CTA order", () => {
  it("renders primary before secondary when both are present", () => {
    const html = renderToStaticMarkup(
      <DashboardPageHeader
        cta={{
          lead: "No new swing entries today.",
          primaryHref: "/trades",
          primaryLabel: "Review open positions",
          secondaryHref: "/setups",
          secondaryLabel: "Open pipeline",
          tertiaryHref: "/trades/new",
          tertiaryLabel: "Log exit or adjustment",
        }}
      />
    );

    const primaryIdx = html.indexOf('data-testid="dashboard-header-primary-cta"');
    const secondaryIdx = html.indexOf('data-testid="dashboard-header-secondary-cta"');
    expect(primaryIdx).toBeGreaterThan(-1);
    expect(secondaryIdx).toBeGreaterThan(-1);
    expect(primaryIdx).toBeLessThan(secondaryIdx);
    expect(html.indexOf("Review open positions")).toBeLessThan(html.indexOf("Open pipeline"));
  });
});
