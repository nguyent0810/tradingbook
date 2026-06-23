import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CommandBarData } from "./types";
import { CommandBar } from "./CommandBar";

const DATA: CommandBarData = {
  session: "2026-06-23",
  vnindex: "1,234.5",
  freshness: "Fresh",
  regime: "Caution",
  volatility: "Normal",
  watchState: "Active watch",
  stats: [
    { label: "Foreign 1D", value: "+120B", tone: "success" },
    { label: "Foreign cov.", value: "85%", tone: "neutral" },
    { label: "Foreign 5D", value: "+340B", tone: "success" },
    { label: "Foreign 10D", value: "+510B", tone: "success" },
  ],
};

const CTA = {
  lead: "Protect capital",
  primaryHref: "/trades",
  primaryLabel: "Review positions",
  secondaryHref: "/setups",
  secondaryLabel: "Open pipeline",
  tertiaryHref: null,
  tertiaryLabel: null,
};

describe("CommandBar session layout", () => {
  it("does not use horizontal overflow on root and collapses foreign flow", () => {
    const html = renderToStaticMarkup(<CommandBar data={DATA} headerCta={CTA} />);
    expect(html).not.toContain("overflow-x-auto");
    expect(html).toContain('data-testid="foreign-flow-chip"');
    expect(html).toContain('data-testid="foreign-flow-detail"');
    expect(html).toContain("Foreign 5D");
    expect(html).toContain("Review positions");
  });
});
