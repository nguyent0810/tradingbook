import { describe, expect, it } from "vitest";
import { buildMarketContextHealthReport } from "@/lib/market/market-context-health";

describe("market-context-health", () => {
  it("reports session mismatch as error issue", async () => {
    const report = await buildMarketContextHealthReport(
      {
        indexDailyBar: {
          findFirst: async () => ({ date: new Date("2026-06-03T00:00:00.000Z") }),
        },
        foreignTradeDaily: {
          count: async () => 0,
        },
        marketContextDaily: {
          findUnique: async () => null,
        },
        symbolMarketContextDaily: {
          count: async () => 0,
        },
      } as unknown as Parameters<typeof buildMarketContextHealthReport>[0],
      "2026-06-02"
    );

    expect(report.sessionAligned).toBe(false);
    expect(report.issues.some((i) => i.code === "session_mismatch")).toBe(true);
  });
});
