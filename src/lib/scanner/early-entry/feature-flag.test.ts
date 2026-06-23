import { describe, expect, it } from "vitest";
import { isEarlyEntryV1Enabled } from "./feature-flag";

describe("EARLY_ENTRY_V1_ENABLED", () => {
  it("is disabled by default", () => {
    const prev = process.env.EARLY_ENTRY_V1_ENABLED;
    delete process.env.EARLY_ENTRY_V1_ENABLED;
    expect(isEarlyEntryV1Enabled()).toBe(false);
    if (prev !== undefined) process.env.EARLY_ENTRY_V1_ENABLED = prev;
  });

  it("enables on true/1/yes", () => {
    const prev = process.env.EARLY_ENTRY_V1_ENABLED;
    for (const v of ["true", "1", "yes"]) {
      process.env.EARLY_ENTRY_V1_ENABLED = v;
      expect(isEarlyEntryV1Enabled()).toBe(true);
    }
    if (prev !== undefined) process.env.EARLY_ENTRY_V1_ENABLED = prev;
    else delete process.env.EARLY_ENTRY_V1_ENABLED;
  });
});
