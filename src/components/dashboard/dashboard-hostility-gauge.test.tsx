import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardHostilityGauge } from "./dashboard-hostility-gauge";
import { resolveHostilityGauge } from "@/lib/dashboard/hostility-gauge";

describe("DashboardHostilityGauge", () => {
  it("renders the score and label for a calm (PASS) gate", () => {
    const html = renderToStaticMarkup(
      <DashboardHostilityGauge gauge={resolveHostilityGauge("PASS")} />
    );
    expect(html).toContain('data-testid="dashboard-hostility-gauge"');
    expect(html).toContain("Ổn định");
    expect(html).toContain("Môi trường rủi ro thuận lợi");
  });

  it("renders the score and label for a hostile (FAIL) gate", () => {
    const html = renderToStaticMarkup(
      <DashboardHostilityGauge gauge={resolveHostilityGauge("FAIL")} />
    );
    expect(html).toContain("Thù nghịch");
    expect(html).toContain("Môi trường rủi ro cao");
  });
});
