import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildNoTradePreviewViewModel } from "@/lib/dashboard/build-no-trade-preview-view-model";
import { DashboardLayout } from "./DashboardLayout";

describe("DashboardLayout cockpit", () => {
  it("uses 30/70 cockpit body with rail and main workbench", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout viewModel={buildNoTradePreviewViewModel()} loading={false} />
    );
    expect(html).toContain("cd-cockpit__body");
    expect(html).toContain("cd-cockpit__rail");
    expect(html).toContain("cd-cockpit__main");
    expect(html).toContain('data-testid="command-deck-rs-workbench"');
    expect(html).toContain("cd-radar-plot--mini");
  });
});
