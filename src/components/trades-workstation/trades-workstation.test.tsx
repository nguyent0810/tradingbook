import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FlashText } from "./FlashText";
import { SummaryMetrics } from "./SummaryMetrics";

describe("FlashText", () => {
  it("renders numeric value without throw", () => {
    const html = renderToStaticMarkup(<FlashText value={42.5} />);
    expect(html).toContain("42.5");
  });
});

describe("SummaryMetrics checkpoint ring", () => {
  it("renders briefing and book context test ids when data present", () => {
    const html = renderToStaticMarkup(
      <SummaryMetrics
        marketFreshness={{
          benchmarkDate: "2026-06-12",
          equityMaxDate: "2026-06-12",
          scanRunAt: null,
          delayedBackdrop: false,
          staleFlags: [],
          scanSessionCoverage: null,
        }}
        latestScan={null}
        scanDelayedBackdrop={null}
        sessionBriefing={{ lines: ["2 active open positions."], partialRiskFigures: false }}
        reviewQueueModel={null}
        bookOperatingContext={{
          headline: "Book stable",
          detailLines: ["2 open"],
        }}
        bookOperatingBalanceLines={[]}
        sinceLastVisitLines={[]}
        compactReview={false}
        hasOpenTrades
        checkpointCompletion={{ reviewedCount: 2, openCount: 2 }}
      />
    );
    expect(html).toContain('data-testid="trades-session-briefing"');
    expect(html).toContain('data-testid="book-operating-context"');
    expect(html).toContain("2 of 2");
  });
});
