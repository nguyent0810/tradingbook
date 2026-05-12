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
        stopLoss: null,
        takeProfit: null,
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
    expect(row.rMultiple).toBeNull();
    expect(row.distanceToStop).toBeNull();
    expect(row.distanceToTakeProfit).toBeNull();
    expect(row.stopValidity).toBe("missing");
    expect(row.priceUnitMismatch).toBe(false);
  });

  it("flags price unit mismatch for absurd entry vs latest close", () => {
    const row = deriveTradesLedgerRowFields(
      {
        id: "t1",
        symbol: "VNM",
        status: "OPEN",
        direction: "LONG",
        entryPrice: 8800,
        quantity: 100,
        stopLoss: 8700,
        takeProfit: null,
        entryDate: new Date("2026-01-01T00:00:00.000Z"),
        exitDate: null,
      },
      {
        latestCloseBySymbol: new Map([
          [
            "VNM",
            { close: 9, date: new Date("2026-01-09T00:00:00.000Z") },
          ],
        ]),
        expectedSessionDate: new Date("2026-01-09T00:00:00.000Z"),
        checkedTodayTradeIds: new Set(),
        now,
      }
    );
    expect(row.priceUnitMismatch).toBe(true);
    expect(row.rMultiple).toBeNull();
    expect(row.distanceToStop).toBeNull();
    expect(row.unrealized?.pnlPct).toBeDefined();
  });

  it("fallbackLedgerDerivedFields is stable", () => {
    expect(fallbackLedgerDerivedFields({ symbol: "AAA" }).symKey).toBe("AAA");
    expect(fallbackLedgerDerivedFields({ symbol: "AAA" }).priceUnitMismatch).toBe(false);
  });
});
