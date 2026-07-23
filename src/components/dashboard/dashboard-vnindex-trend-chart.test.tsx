import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardVnindexTrendChart } from "./dashboard-vnindex-trend-chart";

describe("DashboardVnindexTrendChart", () => {
  it("renders an empty state with fewer than 2 points", () => {
    const html = renderToStaticMarkup(<DashboardVnindexTrendChart history={[]} />);
    expect(html).toContain('data-testid="dashboard-vnindex-trend-chart"');
    expect(html).toContain("chưa có dữ liệu");

    const single = renderToStaticMarkup(
      <DashboardVnindexTrendChart history={[{ date: "2026-07-14", close: 1300 }]} />
    );
    expect(single).toContain("Chưa đủ dữ liệu lịch sử VNINDEX");
  });

  it("renders the chart with 2+ points", () => {
    const html = renderToStaticMarkup(
      <DashboardVnindexTrendChart
        history={[
          { date: "2026-07-13", close: 1290 },
          { date: "2026-07-14", close: 1300 },
        ]}
      />
    );
    expect(html).toContain('data-testid="dashboard-vnindex-trend-chart"');
    expect(html).toContain("VNINDEX — 30 ngày");
    expect(html).not.toContain("Chưa đủ dữ liệu lịch sử VNINDEX");
  });
});
