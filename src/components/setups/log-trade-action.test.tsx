// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Regression cover for the panel-closes-on-success behaviour.
 *
 * The reset lives in `useEffect(..., [state])`, which trips
 * `react-hooks/set-state-in-effect` and is therefore suppressed with a
 * justification in the component. The effect is deliberate: it guarantees a
 * committed render containing the `role="status"` success message (confirmed
 * quantity and fill price) before the panel closes. Moving the reset into the
 * `useActionState` action collapses both into one commit and the confirmation
 * is never rendered — that refactor was attempted and reverted.
 *
 * These tests pin all three properties so a future "cleanup" of the suppression
 * cannot silently drop the confirmation.
 */

const createTradeFromSetup = vi.fn();
const previewTradeLevelsForSetup = vi.fn();

vi.mock("@/app/actions/trades", () => ({
  createTradeFromSetup: (...args: unknown[]) => createTradeFromSetup(...args),
  previewTradeLevelsForSetup: (...args: unknown[]) => previewTradeLevelsForSetup(...args),
}));

const { LogTradeAction } = await import("./log-trade-action");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderOpenedWithForm() {
  previewTradeLevelsForSetup.mockResolvedValue({
    ok: true,
    ticket: {
      asOfSession: "2026-08-07",
      exchange: "HOSE",
      entryZone: { low: 70.0, high: 72.5 },
      entryKvnd: 72.5,
      stopZone: { low: 66.5, high: 67.0 },
      stopKvnd: 66.5,
      targets: [
        { r: 1, priceKvnd: 79 },
        { r: 2, priceKvnd: 85.5 },
        { r: 3, priceKvnd: 92 },
      ],
      defaultTargetR: 2,
      shares: 1000,
      sharesBeforeVerdict: 1000,
      sizeNote: null,
      worstCaseLossVnd: 10_000_000,
      evidence: { prospectiveN: 7, checkpointN: 100 },
    },
  });
  render(<LogTradeAction setupId="setup-1" symbolKey="FPT" />);
  fireEvent.click(screen.getByTestId("log-trade-open-FPT"));

  // The form only renders once the levels preview resolves.
  const panel = screen.getByTestId("log-trade-panel-FPT");
  await waitFor(() => {
    expect(panel.querySelector("form")).toBeTruthy();
  });
  return panel;
}

describe("LogTradeAction", () => {
  it("closes the panel when the trade is created successfully", async () => {
    createTradeFromSetup.mockResolvedValue({ success: true, message: "Đã ghi lệnh." });
    const panel = await renderOpenedWithForm();

    fireEvent.submit(panel.querySelector("form")!);

    await waitFor(() => {
      expect(screen.queryByTestId("log-trade-panel-FPT")).toBeNull();
    });
    // Back to the collapsed trigger, so the user can log another trade.
    expect(screen.getByTestId("log-trade-open-FPT")).toBeTruthy();
  });

  it("renders the role=status confirmation before the panel closes", async () => {
    // Guards the reason the setState-in-effect suppression exists. If the reset
    // is ever moved into the action, the success message never commits and this
    // fails while the close-on-success test above still passes.
    let announced: string | null = null;
    createTradeFromSetup.mockImplementation(async () => ({
      success: true,
      message: "Đã ghi lệnh FPT — 1,000 cp @ 71.20 nghìn ₫.",
    }));

    const panel = await renderOpenedWithForm();
    const observer = new MutationObserver(() => {
      const node = panel.querySelector('[role="status"]');
      if (node?.textContent && announced == null) announced = node.textContent;
    });
    observer.observe(panel, { childList: true, subtree: true });

    fireEvent.submit(panel.querySelector("form")!);
    await waitFor(() => {
      expect(screen.queryByTestId("log-trade-panel-FPT")).toBeNull();
    });
    observer.disconnect();

    expect(announced).toContain("Đã ghi lệnh FPT");
  });

  it("keeps the panel open when the action fails", async () => {
    createTradeFromSetup.mockResolvedValue({ success: false, message: "Không đủ dữ liệu" });
    const panel = await renderOpenedWithForm();

    fireEvent.submit(panel.querySelector("form")!);

    await waitFor(() => {
      expect(createTradeFromSetup).toHaveBeenCalled();
    });
    // The panel must survive a failed submit — otherwise the error is unreadable.
    expect(screen.getByTestId("log-trade-panel-FPT")).toBeTruthy();
  });
});
