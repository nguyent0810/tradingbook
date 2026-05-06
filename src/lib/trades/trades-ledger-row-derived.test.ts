import { describe, expect, it } from "vitest";
import {
  deriveTradesLedgerRowFields,
  fallbackLedgerDerivedFields,
} from "./trades-ledger-row-derived";

describe("deriveTradesLedgerRowFields", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");

  it("returns HHV key and null latest bar when map empty (OPEN)", () => {
    const row = deriveTradesLedgerRowFields(
      {
        id: "t1",
        symbol: " HHV ",
        status: "OPEN",
        direction: "LONG",
        entryPrice: 12,
        quantity: 100,
        entryDate: new Date("2026-01-01T00:00:00.000Z"),
        exitDate: null,
      },
      {
        latestCloseBySymbol: new Map(),
        expectedSessionDate: null,
        checkedTodayTradeIds: new Set(),
        now,
      }
    );
    expect(row.symKey).toBe("HHV");
    expect(row.latestBar).toBeNull();
    expect(row.unrealized).toBeNull();
    expect(row.staleState).toBeNull();
    expect(row.holdingDays).toBe(9);
  });

  it("fallbackLedgerDerivedFields is stable", () => {
    expect(fallbackLedgerDerivedFields({ symbol: "AAA" }).symKey).toBe("AAA");
  });
});
