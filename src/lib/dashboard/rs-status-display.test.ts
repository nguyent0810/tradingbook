import { describe, expect, it } from "vitest";
import {
  friendlyEarlyStateLabel,
  friendlySetupStateLabel,
  setupStateTooltip,
} from "./rs-status-display";

describe("rs-status-display", () => {
  it("maps setup state labels for workbench UI", () => {
    expect(friendlySetupStateLabel("Watch: breakout")).toBe("Wait Breakout");
    expect(friendlySetupStateLabel("Blocked: zone")).toBe("Bad Zone");
    expect(friendlySetupStateLabel("Blocked: MA50")).toBe("Below MA50");
  });

  it("maps early state labels for workbench UI", () => {
    expect(friendlyEarlyStateLabel("Pilot Candidate")).toBe("Pilot Research");
    expect(friendlyEarlyStateLabel("Extended — Do Not Chase")).toBe("Too Extended");
    expect(friendlyEarlyStateLabel("Add Zone")).toBe("Add Watch");
  });

  it("provides tooltips for friendly labels", () => {
    expect(setupStateTooltip("Blocked: zone")).toContain("entry zone");
    expect(setupStateTooltip("Watch: breakout")).toContain("breakout");
  });
});
