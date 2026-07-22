// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildMarketFreshnessDto } from "@/lib/market/market-freshness-dto";
import {
  buildDecisionCockpitDto,
  type DecisionCockpitInput,
} from "@/lib/dashboard/decision-cockpit-dto";
import type { VnindexHistoryPoint } from "@/lib/market/fetch-vnindex-history";
import { DashboardSignalsRail } from "./dashboard-signals-rail";

afterEach(cleanup);

const freshness = buildMarketFreshnessDto({
  snapshot: {
    benchmarkSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestEquityBarSessionDate: new Date(Date.UTC(2026, 4, 25)),
    latestScanRunAt: new Date(Date.UTC(2026, 4, 25, 6, 45, 0)),
  },
});

function minimalInput(overrides: Partial<DecisionCockpitInput> = {}): DecisionCockpitInput {
  return {
    latestScan: null,
    scanNotes: null,
    liveRegime: { level: "WARNING", symbol: "VNINDEX", latestBar: null },
    freshness,
    surfacedCandidates: [],
    watchlist: [],
    ...overrides,
  };
}

const risingHistory: VnindexHistoryPoint[] = [
  { date: "2026-05-01", close: 1000 },
  { date: "2026-05-02", close: 1050 },
];
const fallingHistory: VnindexHistoryPoint[] = [
  { date: "2026-05-01", close: 1050 },
  { date: "2026-05-02", close: 1000 },
];

function renderRail(vnindexHistory: VnindexHistoryPoint[] = risingHistory) {
  const cockpitDto = buildDecisionCockpitDto(minimalInput());
  return render(
    <DashboardSignalsRail
      freshness={freshness}
      latestScan={null}
      scanDelayedBackdrop={null}
      ladder={cockpitDto.setupQualityLadder}
      verdict={cockpitDto.verdict}
      vnindexHistory={vnindexHistory}
      surfacedCount={0}
      evidence={cockpitDto.evidence}
      blockers={cockpitDto.blockers}
    />
  );
}

describe("DashboardSignalsRail / DashboardSignalsDock", () => {
  it("renders 6 icon-only triggers by default, with no widget content visible", () => {
    renderRail();
    const dock = screen.getByTestId("dashboard-signals-rail");
    const triggers = within(dock).getAllByRole("button");
    expect(triggers).toHaveLength(6);
    for (const trigger of triggers) {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    }

    const names = triggers.map((t) => t.getAttribute("aria-label"));
    for (const expected of ["Phán quyết", "Dữ liệu", "Nhịp quét", "Độ tin cậy", "VNINDEX", "Khắc nghiệt"]) {
      expect(names.some((n) => n?.startsWith(expected))).toBe(true);
    }

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking an icon opens its popover with the matching widget content", () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: /^Dữ liệu/ });

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Dữ liệu" })).toBeTruthy();
  });

  it("clicking the same icon again closes the popover", async () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: /^Nhịp quét/ });

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("pressing Escape closes the popover and returns focus to the trigger icon", async () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: /^Độ tin cậy/ });

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(trigger);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("clicking outside the popover closes it", async () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: /^VNINDEX/ });

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeNull();

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opening a different icon while one is open switches the popover to the new widget", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: /^Khắc nghiệt/ }));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Khắc nghiệt" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Phán quyết/ }));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Phán quyết" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Khắc nghiệt/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("tints the market-data icon safe when data is aligned", () => {
    renderRail();
    const trigger = screen.getByRole("button", { name: /^Dữ liệu/ });
    expect(trigger.getAttribute("aria-label")).toContain("Đồng bộ");
    expect(trigger.className).toContain("dash-rail-icon--safe");
  });

  it("tints the VNINDEX icon safe when the index closed up, danger when down", () => {
    const { unmount } = renderRail(risingHistory);
    const up = screen.getByRole("button", { name: /^VNINDEX/ });
    expect(up.className).toContain("dash-rail-icon--safe");
    expect(up.getAttribute("aria-label")).toContain("1,050");
    unmount();

    renderRail(fallingHistory);
    const down = screen.getByRole("button", { name: /^VNINDEX/ });
    expect(down.className).toContain("dash-rail-icon--danger");
    expect(down.getAttribute("aria-label")).toContain("1,000");
  });

  it("shows the current confidence band label on the trigger", () => {
    const cockpitDto = buildDecisionCockpitDto(minimalInput());
    renderRail();
    const bandLabel = { high: "Cao", medium: "Trung bình", low: "Thấp" }[
      cockpitDto.verdict.confidenceBand.value
    ];
    const trigger = screen.getByRole("button", { name: /^Độ tin cậy/ });
    expect(trigger.getAttribute("aria-label")).toContain(bandLabel);
  });

  it("opens the Verdict widget to reveal Today's verdict content", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: /^Phán quyết/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Phán quyết hôm nay")).toBeTruthy();
  });

  it("embeds the scan-pulse widget without its own duplicate header", () => {
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: /^Nhịp quét/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("dashboard-setup-quality-ladder")).toBeTruthy();
    expect(dialog.innerHTML).not.toContain("dash-pulse-header");
  });
});
