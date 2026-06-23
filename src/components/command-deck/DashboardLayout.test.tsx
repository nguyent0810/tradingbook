import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildNoTradePreviewViewModel } from "@/lib/dashboard/build-no-trade-preview-view-model";
import { DashboardLayout } from "./DashboardLayout";

describe("DashboardLayout zones", () => {
  it("wraps grid children in cd-zone for layout decoupling", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout viewModel={buildNoTradePreviewViewModel()} loading={false} />
    );
    expect(html).toContain("cd-grid--main");
    const zoneCount = (html.match(/cd-zone/g) ?? []).length;
    expect(zoneCount).toBeGreaterThanOrEqual(6);
  });
});
