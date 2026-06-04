import { describe, expect, it } from "vitest";
import { buildSetupsEvidenceItems } from "@/components/setups/setups-candidate-evidence";

describe("buildSetupsEvidenceItems — evidence ordering", () => {
  it("orders reasons before market context before health", () => {
    const items = buildSetupsEvidenceItems(
      ["Gate 2: pullback zone valid", "Rank score 71.2"],
      ["Health: decent setup"],
      ["Foreign 1D: −12.40B ₫ net", "Vol 1.4× MA20 (context)"]
    );

    expect(items.map((i) => i.text)).toEqual([
      "Gate 2: pullback zone valid",
      "Rank score 71.2",
      "Foreign 1D: −12.40B ₫ net",
      "Vol 1.4× MA20 (context)",
      "Health: decent setup",
    ]);
    expect(items[0]?.tone).toBe("ok");
    expect(items[2]?.tone).toBe("neutral");
    expect(items[4]?.tone).toBe("neutral");
  });

  it("preserves backward-compatible two-arg call (no context lines)", () => {
    const items = buildSetupsEvidenceItems(["Reason A"], ["Health B"]);
    expect(items.map((i) => i.text)).toEqual(["Reason A", "Health B"]);
  });
});

describe("buildSetupsEvidenceItems — candidate ordering invariant", () => {
  it("does not mutate or sort reason lines (rank order stays in query layer)", () => {
    const reasons = ["Tier A candidate", "RS spread +2.1%"];
    const items = buildSetupsEvidenceItems(reasons, [], ["Foreign 1D: +1.00B ₫ net"]);
    expect(items.filter((i) => i.tone === "ok").map((i) => i.text)).toEqual(reasons);
  });
});
