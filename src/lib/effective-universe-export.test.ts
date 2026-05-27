import { describe, expect, it } from "vitest";
import { buildImportSymbolKeys } from "./effective-universe-export";

describe("buildImportSymbolKeys", () => {
  it("includes core-only and tactical-only symbols", () => {
    const out = buildImportSymbolKeys([
      { symbolId: "s1", symbol: "AAA", universeSource: "CORE" },
      { symbolId: "s2", symbol: "GEX", universeSource: "TACTICAL" },
    ]);
    expect(out).toEqual(["AAA", "GEX"]);
  });

  it("dedupes overlap symbols present in both", () => {
    const out = buildImportSymbolKeys([
      { symbolId: "s1", symbol: "AAA", universeSource: "BOTH" },
      { symbolId: "s1", symbol: "AAA", universeSource: "CORE" },
    ]);
    expect(out).toEqual(["AAA"]);
  });

  it("applies exclusion filter after normalization", () => {
    const out = buildImportSymbolKeys(
      [
        { symbolId: "s1", symbol: "aaa", universeSource: "CORE" },
        { symbolId: "s2", symbol: "P0DEXIT", universeSource: "TACTICAL" },
      ],
      { exclude: (s) => s === "P0DEXIT" }
    );
    expect(out).toEqual(["AAA"]);
  });
});
