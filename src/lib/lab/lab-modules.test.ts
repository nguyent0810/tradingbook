import { describe, expect, it } from "vitest";
import { battleOutcomeToDisplay } from "@/lib/lab/battle/battle-engine";
import { computeSetupSignature } from "@/lib/lab/memory/build-memory";

describe("lab battle engine", () => {
  it("maps verdicts to display labels", () => {
    expect(battleOutcomeToDisplay("CORRECT_BUY")).toBe("WIN");
    expect(battleOutcomeToDisplay("WRONG_BUY")).toBe("LOSS");
    expect(battleOutcomeToDisplay("OPEN")).toBe("OPEN");
  });
});

describe("lab memory", () => {
  it("produces stable setup signatures", () => {
    const a = computeSetupSignature({
      gate2Quality: "A",
      rsBucket: "strong",
      regimeTag: "StrongBull",
      sector: "Tech",
    });
    const b = computeSetupSignature({
      gate2Quality: "A",
      rsBucket: "strong",
      regimeTag: "StrongBull",
      sector: "Tech",
    });
    expect(a).toBe(b);
    expect(a.length).toBe(16);
  });
});
